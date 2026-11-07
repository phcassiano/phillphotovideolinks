import AppKit
import SwiftUI

@main
struct RevelaApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup("Revela") {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 980, minHeight: 640)
                .preferredColorScheme(.dark)
                .tint(Palette.gold)
        }
        .windowToolbarStyle(.unifiedCompact)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Nova sessão…") { NotificationCenter.default.post(name: .newSession, object: nil) }
                    .keyboardShortcut("n")
                Button("Importar fotos…") { model.importPhotos() }
                    .keyboardShortcut("o")
                Button("Importar presets…") { model.importPresets() }
                    .keyboardShortcut("p", modifiers: [.command, .shift])
            }
            CommandGroup(after: .saveItem) {
                Button("Exportar todas com o preset") { model.exportAll() }
                    .keyboardShortcut("e")
            }
        }
    }
}

/** Sem documentos: fechar a janela encerra o app. */
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

extension Notification.Name {
    static let newSession = Notification.Name("revela.newSession")
}

enum Palette {
    static let gold = Color(red: 0.914, green: 0.706, blue: 0.353)
    static let background = Color(red: 0.051, green: 0.051, blue: 0.063)
    static let panel = Color(red: 0.075, green: 0.075, blue: 0.09)
    static let card = Color(red: 0.106, green: 0.106, blue: 0.129)
    static let muted = Color(red: 0.631, green: 0.631, blue: 0.678)
    static let green = Color(red: 0.298, green: 0.827, blue: 0.541)
}
