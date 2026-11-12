package seven.companion.net

interface Explained {
    val explanation: String
}

class SevenProblem(override val explanation: String) : Exception(explanation), Explained

fun Throwable.explanation(): String? =
    generateSequence(this) { it.cause }.firstNotNullOfOrNull { (it as? Explained)?.explanation }
