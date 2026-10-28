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
        versionCode = 20
        versionName = "0.9.7-beta"
    }

    // Chave fixa e só para uso próprio: assim um APK novo instala por cima do antigo,
    // não importa em qual máquina ele foi gerado.
    signingConfigs {
        create("own") {
            storeFile = rootProject.file("keystore/sony-tether.keystore")
            storePassword = "sonytether"
            keyAlias = "sonytether"
            keyPassword = "sonytether"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("own")
        }
        debug {
            signingConfig = signingConfigs.getByName("own")
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
