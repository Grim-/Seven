package seven.companion

import android.app.Application
import android.content.Context

class SevenApp : Application() {
    lateinit var services: Services
        private set

    override fun onCreate() {
        super.onCreate()
        services = Services(this)
    }
}

val Context.services: Services
    get() = (applicationContext as SevenApp).services
