import AppKit
import SwiftUI
import Combine
import Carbon.HIToolbox

/// Janela sem borda que flutua no topo da tela, sobre a barra de menus.
final class NotchPanel: NSPanel {
    init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 200, height: 24),
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        level = .statusBar
        // Aparece em todas as mesas; NÃO aparece sobre apps em tela cheia (some sozinha em jogos/vídeos).
        collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        isMovable = false
        hidesOnDeactivate = false
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Detecta o mouse entrando/saindo, mesmo com o app em segundo plano.
final class HoverView: NSView {
    var onEnter: (() -> Void)?
    var onExit: (() -> Void)?
    private var area: NSTrackingArea?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area { removeTrackingArea(area) }
        let a = NSTrackingArea(rect: bounds,
                               options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                               owner: self, userInfo: nil)
        addTrackingArea(a)
        area = a
    }

    override func mouseEntered(with event: NSEvent) { onEnter?() }
    override func mouseExited(with event: NSEvent) { onExit?() }
}

/// Posiciona a ilha, expande ao passar o mouse e recolhe ao sair.
@MainActor
final class NotchController {
    let state: AppState
    let panel = NotchPanel()
    private var bag = Set<AnyCancellable>()
    private var hoverTimer: Timer?
    private var collapseTimer: Timer?
    private var mouseInside = false

    init(state: AppState, assistant: Assistant, openSettings: @escaping @MainActor () -> Void) {
        self.state = state

        let root = RootView(state: state, assistant: assistant, openSettings: openSettings)
        let hosting = NSHostingView(rootView: root)
        hosting.sizingOptions = []
        let container = HoverView(frame: NSRect(x: 0, y: 0, width: 200, height: 24))
        hosting.frame = container.bounds
        hosting.autoresizingMask = [.width, .height]
        container.addSubview(hosting)
        container.onEnter = { [weak self] in self?.mouseEntered() }
        container.onExit = { [weak self] in self?.mouseExited() }
        panel.contentView = container

        updateGeometry()
        layout(animated: false)
        panel.orderFrontRegardless()

        state.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.layout(animated: true) }
            .store(in: &bag)

        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                assistant.tools.refreshDisplays()
                self?.updateGeometry()
                self?.layout(animated: false)
            }
            .store(in: &bag)

        NotificationCenter.default.publisher(for: NSWindow.didResignKeyNotification, object: panel)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.panelResignedKey() }
            .store(in: &bag)
    }

    // MARK: Geometria

    private var screen: NSScreen? { NSScreen.screens.first }

    func updateGeometry() {
        guard let screen else { return }
        let menuBar = screen.frame.maxY - screen.visibleFrame.maxY
        state.menuBarHeight = max(24, menuBar, screen.safeAreaInsets.top)
        if screen.safeAreaInsets.top > 0,
           let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea {
            state.notchWidth = screen.frame.width - left.width - right.width + 8
        } else {
            state.notchWidth = 0
        }
    }

    private func collapsedSize() -> NSSize {
        let h = state.islandStyle == "ilha" ? 30 : state.menuBarHeight
        let hasInfo = state.mode != .idle || !state.pillText.isEmpty
        if state.notchWidth > 0 {
            return NSSize(width: state.notchWidth + (hasInfo ? 340 : 200), height: h)
        }
        return NSSize(width: hasInfo ? 400 : 200, height: h)
    }

    private func targetFrame() -> NSRect {
        guard let screen else { return .zero }
        let size: NSSize
        if state.expanded {
            size = NSSize(width: 740, height: 560 + (state.notchWidth > 0 ? state.menuBarHeight : 0))
        } else {
            size = collapsedSize()
        }
        let sf = screen.frame
        // Ilha: solta, um pouco abaixo da barra de menus. Entalho: colada no topo.
        let top = state.islandStyle == "ilha" ? state.menuBarHeight + 6 : 0
        return NSRect(x: (sf.midX - size.width / 2).rounded(), y: sf.maxY - top - size.height,
                      width: size.width, height: size.height)
    }

    func layout(animated: Bool) {
        let f = targetFrame()
        if !state.expanded && panel.isKeyWindow {
            // devolve o teclado para o app que estava em uso
            panel.orderOut(nil)
            panel.orderFrontRegardless()
        }
        guard f != panel.frame else { return }
        panel.setFrame(f, display: true, animate: animated)
    }

    // MARK: Mouse

    private func mouseEntered() {
        mouseInside = true
        collapseTimer?.invalidate()
        guard !state.expanded else { return }
        hoverTimer?.invalidate()
        hoverTimer = after(0.25) { [weak self] in
            guard let self, self.mouseInside else { return }
            self.state.expanded = true
        }
    }

    private func mouseExited() {
        mouseInside = false
        hoverTimer?.invalidate()
        scheduleCollapse(0.6)
    }

    private func panelResignedKey() {
        state.inputFocused = false
        if !mouseInside { scheduleCollapse(0.3) }
    }

    private func scheduleCollapse(_ delay: TimeInterval) {
        collapseTimer?.invalidate()
        collapseTimer = after(delay) { [weak self] in self?.collapseIfPossible() }
    }

    private func collapseIfPossible() {
        guard state.expanded, !mouseInside, !state.pinned, !state.inputFocused else { return }
        state.expanded = false
    }

    // MARK: Atalho de teclado

    /// Toque rápido no atalho: abre (ou fecha) com a caixa de texto pronta.
    func toggleFromKeyboard() {
        if state.expanded {
            state.pinned = false
            state.inputFocused = false
            state.expanded = false
        } else {
            state.tab = .chat
            state.expanded = true
            panel.makeKeyAndOrderFront(nil)
            state.wantsFocus = true
        }
    }

    func open() {
        state.expanded = true
        state.pinned = true
    }

    func openTab(_ tab: PanelTab) {
        state.tab = tab
        state.expanded = true
        state.pinned = true
    }
}

/// Atalhos globais (⌥ Espaço, ⌃⌥V, atalhos de janela…).
@MainActor
enum HotKey {
    private static var handlers: [UInt32: @MainActor (Bool) -> Void] = [:]
    private static var refs: [EventHotKeyRef] = []
    private static var installed = false

    static func register(id: UInt32, keyCode: Int, modifiers: Int, handler: @escaping @MainActor (Bool) -> Void) {
        install()
        handlers[id] = handler
        var ref: EventHotKeyRef?
        let hkID = EventHotKeyID(signature: OSType(0x5345_5854), id: id) // "SEXT"
        let status = RegisterEventHotKey(UInt32(keyCode), UInt32(modifiers), hkID, GetApplicationEventTarget(), 0, &ref)
        if status != noErr {
            NSLog("Não consegui registrar o atalho %d (já está em uso?)", Int(id))
        } else if let ref {
            refs.append(ref)
        }
    }

    static func fire(_ id: UInt32, _ pressed: Bool) {
        handlers[id]?(pressed)
    }

    private static func install() {
        guard !installed else { return }
        installed = true
        var types = [
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)),
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased)),
        ]
        InstallEventHandler(GetApplicationEventTarget(), hotKeyCallback, 2, &types, nil, nil)
    }
}

private func hotKeyCallback(_ next: EventHandlerCallRef?, _ event: EventRef?,
                            _ userData: UnsafeMutableRawPointer?) -> OSStatus {
    guard let event else { return OSStatus(eventNotHandledErr) }
    var hkID = EventHotKeyID()
    let err = GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                                nil, MemoryLayout<EventHotKeyID>.size, nil, &hkID)
    guard err == noErr else { return OSStatus(eventNotHandledErr) }
    let pressed = GetEventKind(event) == UInt32(kEventHotKeyPressed)
    let id = hkID.id
    Task { @MainActor in HotKey.fire(id, pressed) }
    return noErr
}
