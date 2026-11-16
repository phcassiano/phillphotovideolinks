// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SextaFeira",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "SextaFeira",
            path: "Sources/SextaFeira"
        )
    ]
)
