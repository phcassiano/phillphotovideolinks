// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SextaFeira",
    platforms: [.macOS(.v13)],
    targets: [
        // Acesso ao SMC (bateria, sensores, ventoinhas)
        .target(
            name: "SMC",
            path: "Sources/SMC",
            linkerSettings: [.linkedFramework("IOKit")]
        ),
        // O app
        .executableTarget(
            name: "SextaFeira",
            dependencies: ["SMC"],
            path: "Sources/SextaFeira"
        ),
        // Ajudante que roda como root: limite de carga real, ventoinha e purge de memória
        .executableTarget(
            name: "SextaFeiraHelper",
            dependencies: ["SMC"],
            path: "Sources/SextaFeiraHelper",
            linkerSettings: [.linkedFramework("IOKit")]
        ),
    ]
)
