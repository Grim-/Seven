package seven.companion.proxy

import android.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import seven.companion.net.SevenProblem
import seven.companion.net.explanation
import seven.companion.session.Connection
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.BindException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom
import java.util.Collections
import java.util.concurrent.Executors
import javax.net.ssl.SSLSocket

class LoopbackProxy(private val connection: Connection, port: Int, private val connectMillis: Int) {
    private val token = ByteArray(32).also(SecureRandom()::nextBytes).let { Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING) }
    private val cookie = "$COOKIE=$token"
    private val server = try {
        ServerSocket(port, BACKLOG, InetAddress.getByAddress(LOOPBACK))
    } catch (e: BindException) {
        throw SevenProblem("Port $port on this phone is in use by another app. Change the local port in Settings.")
    }
    private val pool = Executors.newCachedThreadPool()
    private val sockets = Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap<Socket, Boolean>())
    private val _problem = MutableStateFlow<String?>(null)

    val origin: String = "http://${server.inetAddress.hostAddress}:${server.localPort}"
    val cookieHeader: String = "$cookie; Path=/; HttpOnly; SameSite=Strict"
    val problem: StateFlow<String?> = _problem

    fun start() {
        pool.execute {
            while (!server.isClosed) {
                val local = try {
                    server.accept()
                } catch (e: IOException) {
                    break
                }
                pool.execute { serve(local) }
            }
        }
    }

    fun stop() {
        runCatching { server.close() }
        sockets.toList().forEach { runCatching { it.close() } }
        pool.shutdownNow()
    }

    private fun serve(local: Socket) {
        track(local) {
            val input = local.getInputStream().buffered()
            val head = RequestHead.read(input, HEAD_LIMIT) ?: return@track
            if (!head.carries(cookie)) return@track refuse(local.getOutputStream(), 403, "Forbidden", "This page is only for the Seven app.")
            val upstream = try {
                dial()
            } catch (e: IOException) {
                val message = e.explanation() ?: "Couldn't reach Seven at ${connection.address.authority}."
                _problem.value = message
                return@track refuse(local.getOutputStream(), 502, "Bad Gateway", message)
            }
            _problem.value = null
            track(upstream) {
                upstream.getOutputStream().apply {
                    write(head.forward(connection.address.authority, connection.seven.authorization, cookie))
                    flush()
                }
                pool.execute {
                    relay(input, upstream.getOutputStream())
                    runCatching { upstream.close() }
                }
                relay(upstream.getInputStream(), local.getOutputStream())
            }
        }
    }

    private fun dial(): Socket {
        val raw = Socket()
        try {
            raw.connect(InetSocketAddress(connection.address.host, connection.address.port), connectMillis)
            val tls = connection.tls.socketFactory.createSocket(raw, connection.address.host, connection.address.port, true) as SSLSocket
            tls.startHandshake()
            return tls
        } catch (e: IOException) {
            runCatching { raw.close() }
            throw e
        }
    }

    private inline fun track(socket: Socket, work: () -> Unit) {
        sockets += socket
        try {
            work()
        } catch (e: IOException) {
        } finally {
            sockets -= socket
            runCatching { socket.close() }
        }
    }

    private fun relay(from: InputStream, to: OutputStream) {
        val buffer = ByteArray(BUFFER)
        try {
            while (true) {
                val n = from.read(buffer)
                if (n < 0) break
                to.write(buffer, 0, n)
                to.flush()
            }
        } catch (e: IOException) {
        }
    }

    private fun refuse(out: OutputStream, status: Int, reason: String, message: String) {
        val body = JSONObject().put("error", JSONObject().put("message", message).put("code", status)).toString().toByteArray()
        val head = "HTTP/1.1 $status $reason\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n"
        out.write(head.toByteArray(Charsets.ISO_8859_1))
        out.write(body)
        out.flush()
    }

    private companion object {
        const val COOKIE = "seven-proxy"
        val LOOPBACK = byteArrayOf(127, 0, 0, 1)
        const val BACKLOG = 50
        const val HEAD_LIMIT = 64 * 1024
        const val BUFFER = 16 * 1024
    }
}
