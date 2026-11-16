import SwiftUI
import AppKit
import UserNotifications
import Carbon.HIToolbox

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
    private var widgets: DesktopWidgets!
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
        widgets = DesktopWidgets(tools: assistant.tools, state: state)
        assistant.onPrefsChanged = { [weak self] in
            self?.pet.setEnabled(Prefs.petEnabled)
            self?.widgets.refresh()
            self?.assistant.tools.menuBar.setEnabled(Prefs.menuBarClean)
        }

        setupStatusItem()

        registerHotKeys()

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }

        assistant.applyPrefs()

        if !UserDefaults.standard.bool(forKey: "jaConfigurado") {
            UserDefaults.standard.set(true, forKey: "jaConfigurado")
            openSettings()
        }
    }

    private func registerHotKeys() {
        HotKey.register(id: 1, keyCode: kVK_Space, modifiers: optionKey) { [weak self] pressed in self?.hotKey(pressed) }
        // ⌃⌥V: histórico do que você copiou
        HotKey.register(id: 2, keyCode: kVK_ANSI_V, modifiers: controlKey | optionKey) { [weak self] pressed in
            if pressed { self?.notch.openTab(.clips) }
        }
        // Janelas: ⌃⌥ + setas / Return / C, e ⌃⌥⌘ ← → para trocar de monitor
        let ctrlOpt = controlKey | optionKey
        let snaps: [(UInt32, Int, Int, WindowSnap)] = [
            (10, kVK_LeftArrow, ctrlOpt, .left), (11, kVK_RightArrow, ctrlOpt, .right),
            (12, kVK_UpArrow, ctrlOpt, .top), (13, kVK_DownArrow, ctrlOpt, .bottom),
            (14, kVK_Return, ctrlOpt, .maximize), (15, kVK_ANSI_C, ctrlOpt, .center),
            (16, kVK_RightArrow, ctrlOpt | cmdKey, .nextDisplay), (17, kVK_LeftArrow, ctrlOpt | cmdKey, .previousDisplay),
        ]
        for (id, key, mods, snap) in snaps {
            HotKey.register(id: id, keyCode: key, modifiers: mods) { pressed in
                guard pressed, Prefs.windowHotkeys else { return }
                if let msg = WindowManager.snap(snap) { Notifier.post(title: "Janelas", body: msg) }
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        DisplayDimmer.resetAll()
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
