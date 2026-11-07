// swift-tools-version:5.9
import PackageDescription

// Revela para Mac: tethering da câmera pelo USB com os presets do Lightroom.
// RevelaCore não depende de interface nem de câmera (presets, cores, PTP): é o que os testes cobrem.
let package = Package(
    name: "Revela",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "RevelaCore"),
        .executableTarget(name: "Revela", dependencies: ["RevelaCore"]),
        .testTarget(name: "RevelaCoreTests", dependencies: ["RevelaCore"]),
    ]
)
