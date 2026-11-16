import SwiftUI
import AppKit
import UserNotifications

@main
struct SextaFeiraApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Settings { EmptyView() }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var state: AppState!
    private var assistant: Assistant!
    private var notch: NotchController!
    private var pet: DesktopPet!
    private var statusItem: NSStatusItem!
    private var settingsWindow: NSWindow?
    private var holdTimer: Timer?
    private var pushing = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        let state = AppState()
        let assistant = Assistant(state: state)
        self.state = state
        self.assistant = assistant
        notch = NotchController(state: state, assistant: assistant,
                                openSettings: { [weak self] in self?.openSettings() })

        pet = DesktopPet(app: state)
        assistant.onPrefsChanged = { [weak self] in self?.pet.setEnabled(Prefs.petEnabled) }

        setupStatusItem()

        HotKey.handler = { [weak self] pressed in self?.hotKey(pressed) }
        HotKey.register()

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }

        assistant.applyPrefs()

        if !UserDefaults.standard.bool(forKey: "jaConfigurado") {
            UserDefaults.standard.set(true, forKey: "jaConfigurado")
            openSettings()
        }
    }

    // MARK: ⌥ Espaço — segurar = falar, toque rápido = abrir/fechar

    private func hotKey(_ pressed: Bool) {
        if pressed {
            guard holdTimer == nil, !pushing else { return }
            assistant.interrupt()
            holdTimer = after(0.25) { [weak self] in
                guard let self else { return }
                self.holdTimer = nil
                self.pushing = true
                self.assistant.startListening()
            }
        } else {
            if let t = holdTimer {
                t.invalidate()
                holdTimer = nil
                notch.toggleFromKeyboard()
            } else if pushing {
                pushing = false
                assistant.stopListening()
            }
        }
    }

    // MARK: Ícone na barra de menus

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "face.smiling", accessibilityDescription: "Sexta-feira")

        let menu = NSMenu()
        let items: [(String, Selector, String)] = [
            ("Abrir", #selector(openPanel), ""),
            ("Configurações…", #selector(openSettingsAction), ","),
        ]
        for (title, action, key) in items {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.target = self
            menu.addItem(item)
        }
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Sair", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        statusItem.menu = menu
    }

    @objc private func openPanel() { notch.open() }
    @objc private func openSettingsAction() { openSettings() }
    @objc private func quitApp() { NSApp.terminate(nil) }

    func openSettings() {
        if settingsWindow == nil {
            let w = NSWindow(contentViewController: NSHostingController(rootView: SettingsView(assistant: assistant)))
            w.title = "Configurações — Sexta-feira"
            w.styleMask = [.titled, .closable]
            w.isReleasedWhenClosed = false
            settingsWindow = w
        }
        state.expanded = false
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.center()
        settingsWindow?.makeKeyAndOrderFront(nil)
    }
}
