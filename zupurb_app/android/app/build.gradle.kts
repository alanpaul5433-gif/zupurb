plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load signing credentials from env vars (CI) or android/key.properties (local dev).
// See signing.gradle.kts for the full resolution chain.
apply(from = "signing.gradle.kts")

android {
    namespace = "com.zupurb.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.zupurb.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["MAPS_API_KEY"] = project.findProperty("MAPS_API_KEY") ?: "PLACEHOLDER_MAPS_KEY"
    }

    // ---------------------------------------------------------------------------
    // Release signing — reads credentials resolved by signing.gradle.kts.
    // CI supplies them via GitHub Actions secrets (ANDROID_KEYSTORE_BASE64 is
    // decoded to a temp .jks file; KEYSTORE_PATH points to that file).
    // Local dev: copy android/key.properties.template → android/key.properties.
    // If no credentials are found the build falls back to debug signing so that
    // `flutter run --release` still works on a developer machine without a keystore.
    // ---------------------------------------------------------------------------
    val credsAvailable = extra["signingCredentialsAvailable"] as Boolean

    if (credsAvailable) {
        signingConfigs {
            create("release") {
                storeFile = file(extra["signingKeystorePath"] as String)
                storePassword = extra["signingKeystorePassword"] as String
                keyAlias = extra["signingKeyAlias"] as String
                keyPassword = extra["signingKeyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (credsAvailable) {
                signingConfigs.getByName("release")
            } else {
                // Fallback: debug signing for local builds without a keystore.
                // CI builds will fail fast if any credential env var is missing.
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
