package seven.companion.scan

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer

class QrAnalyzer(private val onText: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val reader = MultiFormatReader().apply {
        setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE)))
    }

    override fun analyze(image: ImageProxy) {
        image.use {
            val plane = it.planes[0]
            val buffer = plane.buffer
            val data = ByteArray(buffer.remaining()).also(buffer::get)
            val source = PlanarYUVLuminanceSource(data, plane.rowStride, it.height, 0, 0, it.width, it.height, false)
            try {
                onText(reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text)
            } catch (missing: NotFoundException) {
                return
            } finally {
                reader.reset()
            }
        }
    }
}
