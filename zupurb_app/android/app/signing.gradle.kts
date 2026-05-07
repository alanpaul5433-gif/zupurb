// signing.gradle.kts
// Signing configuration template for Zupurb Android release builds.
//
// In CI (GitHub Actions):
//   - ANDROID_KEYSTORE_BASE64 is base64-encoded .jks, decoded to a temp file at runtime.
//   - KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD are stored in GitHub Actions secrets.
//   - The workflow decodes ANDROID_KEYSTORE_BASE64 and sets KEYSTORE_PATH before
//     invoking Gradle.  See .github/workflows/release.yml for the exact decode step.
//
// For local development:
//   - Copy android/key.properties.template to android/key.properties and fill in real values.
//   - key.properties is gitignored; never commit it.
//   - build.gradle.kts reads key.properties when KEYSTORE_PATH env var is absent.
//
// Required environment variables (CI) / key.properties keys (local):
//   KEYSTORE_PATH     — absolute path to the .jks file
//   KEYSTORE_PASSWORD — keystore password
//   KEY_ALIAS         — key alias (default: upload)
//   KEY_PASSWORD      — key password
//
// This file is applied via `apply(from = "signing.gradle.kts")` in build.gradle.kts.
// It registers a "release" signingConfig on the android extension if all credentials
// are resolvable; otherwise it falls back to the debug signing config so local builds
// without credentials do not fail.

val keystorePath: String? = System.getenv("KEYSTORE_PATH")
    ?: run {
        val props = java.util.Properties()
        val propsFile = rootProject.file("android/key.properties")
        if (propsFile.exists()) props.load(propsFile.inputStream())
        props.getProperty("storeFile")?.let { file(it).absolutePath }
    }

val keystorePassword: String? = System.getenv("KEYSTORE_PASSWORD")
    ?: run {
        val props = java.util.Properties()
        val propsFile = rootProject.file("android/key.properties")
        if (propsFile.exists()) props.load(propsFile.inputStream())
        props.getProperty("storePassword")
    }

val keyAlias: String? = System.getenv("KEY_ALIAS")
    ?: run {
        val props = java.util.Properties()
        val propsFile = rootProject.file("android/key.properties")
        if (propsFile.exists()) props.load(propsFile.inputStream())
        props.getProperty("keyAlias")
    }

val keyPassword: String? = System.getenv("KEY_PASSWORD")
    ?: run {
        val props = java.util.Properties()
        val propsFile = rootProject.file("android/key.properties")
        if (propsFile.exists()) props.load(propsFile.inputStream())
        props.getProperty("keyPassword")
    }

// Expose resolved values as project extras so build.gradle.kts can consume them.
extra["signingKeystorePath"] = keystorePath
extra["signingKeystorePassword"] = keystorePassword
extra["signingKeyAlias"] = keyAlias
extra["signingKeyPassword"] = keyPassword
extra["signingCredentialsAvailable"] = listOf(
    keystorePath, keystorePassword, keyAlias, keyPassword
).all { !it.isNullOrBlank() }
