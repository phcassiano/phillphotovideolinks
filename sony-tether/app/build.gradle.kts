import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.phill.sonytether"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.phill.sonytether"
        minSdk = 29
        targetSdk = 34
        versionCode = 23
        versionName = "0.9.10-beta"
    }

    // A chave de assinatura fica FORA do repositório (quem tem a chave consegue publicar
    // "atualizações" do Revela). Vem de keystore.properties, no caminho de
    // REVELA_KEYSTORE_PROPERTIES ou em sony-tether/keystore.properties (ignorado pelo git).
    // Sem ela, o APK de release sai sem assinatura e não instala.
    val signing = (System.getenv("REVELA_KEYSTORE_PROPERTIES")?.let(::file) ?: rootProject.file("keystore.properties"))
        .takeIf { it.isFile }
        ?.let { f -> Properties().apply { f.inputStream().use { load(it) } } }
    signingConfigs {
        if (signing != null) create("release") {
            storeFile = file(signing.getProperty("storeFile"))
            storePassword = signing.getProperty("storePassword")
            keyAlias = signing.getProperty("keyAlias")
            keyPassword = signing.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (signing != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all { test ->
                test.systemProperty("robolectric.dependency.repo.url", "https://maven-central.storage-download.googleapis.com/maven2/")
                if (project.hasProperty("screenshots")) {
                    test.systemProperty("screenshots", file("../design").absolutePath)
                } else {
                    test.exclude("**/ScreenshotTest*") // baixa um Android inteiro: só quando pedido
                }
            }
        }
    }
    lint {
        // App de uso próprio: textos fixos em português, sem tradução.
        disable += setOf("SetTextI18n", "ObsoleteSdkInt")
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    // Cliente FTP de verdade para testar o servidor do app.
    testImplementation("commons-net:commons-net:3.11.1")
    // Só para as capturas de tela do design (ScreenshotTest, roda com -Pscreenshots).
    testImplementation("org.robolectric:robolectric:4.14.1")
}
