import AppKit
import ApplicationServices

// MARK: - Limpeza de disco

struct CleanItem: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let path: String
    let size: Int64
    var selected: Bool
    /// Seguro para limpar automaticamente no Boost.
    let safe: Bool
    let note: String
}

enum Cleaner {
    /// Procura caches, logs e restos de desenvolvimento. `running` = bundle IDs de apps abertos.
    static func scan(running: Set<String>) -> [CleanItem] {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser
        var items: [CleanItem] = []

        let caches = home.appendingPathComponent("Library/Caches")
        for name in (try? fm.contentsOfDirectory(atPath: caches.path)) ?? [] {
            // Caches da Apple ficam de fora por segurança.
            if name.hasPrefix("com.apple") || name.hasPrefix(".") { continue }
            let url = caches.appendingPathComponent(name)
            guard let size = MacInfo.folderSize(url), size > 10_000_000 else { continue }
            let open = running.contains(name.lowercased())
            items.append(CleanItem(name: name, path: url.path, size: size, selected: !open, safe: !open,
                                   note: open ? "App aberto: feche antes de limpar" : "Cache: o app recria se precisar"))
        }

        let logs = home.appendingPathComponent("Library/Logs")
        if let size = MacInfo.folderSize(logs), size > 5_000_000 {
            items.append(CleanItem(name: "Logs dos apps", path: logs.path, size: size, selected: true, safe: true,
                                   note: "Registros antigos de apps"))
        }

        let derived = home.appendingPathComponent("Library/Developer/Xcode/DerivedData")
        if let size = MacInfo.folderSize(derived), size > 50_000_000 {
            items.append(CleanItem(name: "Xcode DerivedData", path: derived.path, size: size, selected: true, safe: true,
                                   note: "Arquivos temporários de compilação"))
        }

        return items.sorted { $0.size > $1.size }
    }

    /// Apaga os itens. Devolve quantos bytes foram liberados.
    static func clean(_ items: [CleanItem]) -> Int64 {
        let fm = FileManager.default
        var freed: Int64 = 0
        for item in items {
            if item.name == "Logs dos apps" {
                // Apaga só o conteúdo, mantém a pasta Logs.
                for child in (try? fm.contentsOfDirectory(atPath: item.path)) ?? [] {
                    try? fm.removeItem(atPath: (item.path as NSString).appendingPathComponent(child))
                }
                freed += item.size
            } else if (try? fm.removeItem(atPath: item.path)) != nil {
                freed += item.size
            }
        }
        return freed
    }

    static func trashSize() -> Int64? {
        MacInfo.folderSize(FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".Trash"))
    }
}

// MARK: - Desinstalador completo

struct AppEntry: Identifiable, Hashable {
    var id: String { path }
    let name: String
    let path: String
    let bundleID: String?
}

struct Leftover: Identifiable, Equatable {
    let id = UUID()
    let path: String
    let size: Int64
    var selected = true

    var label: String {
        path.replacingOccurrences(of: FileManager.default.homeDirectoryForCurrentUser.path, with: "~")
    }
}

enum Uninstaller {
    static func apps() -> [AppEntry] {
        let fm = FileManager.default
        let dirs = ["/Applications", fm.homeDirectoryForCurrentUser.appendingPathComponent("Applications").path]
        var result: [AppEntry] = []
        for dir in dirs {
            for item in (try? fm.contentsOfDirectory(atPath: dir)) ?? [] where item.hasSuffix(".app") {
                let path = (dir as NSString).appendingPathComponent(item)
                let bid = Bundle(path: path)?.bundleIdentifier
                if bid?.hasPrefix("com.apple.") == true { continue }
                result.append(AppEntry(name: String(item.dropLast(4)), path: path, bundleID: bid))
            }
        }
        return result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func leftovers(for app: AppEntry) -> [Leftover] {
        let fm = FileManager.default
        let lib = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library")
        var paths = [app.path]
        var cands: [String] = []
        if let bid = app.bundleID {
            cands += [
                "Application Support/\(bid)", "Caches/\(bid)", "Preferences/\(bid).plist",
                "Containers/\(bid)", "Saved Application State/\(bid).savedState", "HTTPStorages/\(bid)",
                "HTTPStorages/\(bid).binarycookies", "WebKit/\(bid)", "Cookies/\(bid).binarycookies",
                "LaunchAgents/\(bid).plist", "Logs/\(bid)", "Application Scripts/\(bid)",
            ]
            let groups = lib.appendingPathComponent("Group Containers").path
            for g in (try? fm.contentsOfDirectory(atPath: groups)) ?? [] where g.hasSuffix(bid) {
                cands.append("Group Containers/\(g)")
            }
        }
        cands += ["Application Support/\(app.name)", "Caches/\(app.name)", "Logs/\(app.name)"]
        for c in cands {
            let p = lib.appendingPathComponent(c).path
            if fm.fileExists(atPath: p) && !paths.contains(p) { paths.append(p) }
        }
        return paths.map { Leftover(path: $0, size: size(of: $0)) }
    }

    static func size(of path: String) -> Int64 {
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDir) else { return 0 }
        if isDir.boolValue { return MacInfo.folderSize(URL(fileURLWithPath: path)) ?? 0 }
        let attrs = try? FileManager.default.attributesOfItem(atPath: path)
        return (attrs?[.size] as? NSNumber)?.int64Value ?? 0
    }

    /// Fecha o app e move tudo para o Lixo. Devolve os caminhos que falharam.
    @MainActor
    static func uninstall(_ app: AppEntry, items: [Leftover]) -> [String] {
        if let bid = app.bundleID {
            for running in NSRunningApplication.runningApplications(withBundleIdentifier: bid) { running.terminate() }
        }
        var failed: [String] = []
        for item in items where item.selected {
            do {
                try FileManager.default.trashItem(at: URL(fileURLWithPath: item.path), resultingItemURL: nil)
            } catch {
                failed.append(item.label)
            }
        }
        return failed
    }
}

// MARK: - Gerenciador de janelas

enum WindowSnap: String, CaseIterable {
    case left, right, top, bottom, topLeft, topRight, bottomLeft, bottomRight
    case leftThird, centerThird, rightThird, maximize, center, nextDisplay, previousDisplay

    var title: String {
        switch self {
        case .left: return "Metade esquerda"
        case .right: return "Metade direita"
        case .top: return "Metade de cima"
        case .bottom: return "Metade de baixo"
        case .topLeft: return "Canto sup. esquerdo"
        case .topRight: return "Canto sup. direito"
        case .bottomLeft: return "Canto inf. esquerdo"
        case .bottomRight: return "Canto inf. direito"
        case .leftThird: return "Terço esquerdo"
        case .centerThird: return "Terço do meio"
        case .rightThird: return "Terço direito"
        case .maximize: return "Tela cheia"
        case .center: return "Centralizar"
        case .nextDisplay: return "Próximo monitor"
        case .previousDisplay: return "Monitor anterior"
        }
    }

    var icon: String {
        switch self {
        case .left: return "rectangle.lefthalf.filled"
        case .right: return "rectangle.righthalf.filled"
        case .top: return "rectangle.tophalf.filled"
        case .bottom: return "rectangle.bottomhalf.filled"
        case .topLeft: return "arrow.up.left.square"
        case .topRight: return "arrow.up.right.square"
        case .bottomLeft: return "arrow.down.left.square"
        case .bottomRight: return "arrow.down.right.square"
        case .leftThird: return "rectangle.leadinghalf.inset.filled"
        case .centerThird: return "rectangle.center.inset.filled"
        case .rightThird: return "rectangle.trailinghalf.inset.filled"
        case .maximize: return "rectangle.fill"
        case .center: return "rectangle.center.inset.filled"
        case .nextDisplay: return "rectangle.portrait.and.arrow.right"
        case .previousDisplay: return "rectangle.portrait.and.arrow.forward"
        }
    }

    /// Atalho de teclado, quando houver.
    var shortcut: String? {
        switch self {
        case .left: return "⌃⌥←"
        case .right: return "⌃⌥→"
        case .top: return "⌃⌥↑"
        case .bottom: return "⌃⌥↓"
        case .maximize: return "⌃⌥↩"
        case .center: return "⌃⌥C"
        case .nextDisplay: return "⌃⌥⌘→"
        case .previousDisplay: return "⌃⌥⌘←"
        default: return nil
        }
    }
}

enum WindowManager {
    static var trusted: Bool { AXIsProcessTrusted() }

    static func askPermission() {
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
    }

    /// Move/redimensiona a janela do app em primeiro plano. Devolve um aviso se não deu.
    @MainActor
    static func snap(_ snap: WindowSnap) -> String? {
        guard trusted else {
            askPermission()
            return "Preciso da permissão de Acessibilidade: Ajustes do Sistema › Privacidade e Segurança › Acessibilidade › Sexta-feira."
        }
        guard let app = NSWorkspace.shared.frontmostApplication,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier else {
            return "Clique na janela que você quer mover e tente de novo."
        }
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        var winRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &winRef) == .success,
              let winObj = winRef else {
            return "Não achei uma janela ativa."
        }
        let window = winObj as! AXUIElement

        guard let primary = NSScreen.screens.first else { return nil }
        let h = primary.frame.height
        let current = frame(of: window, primaryHeight: h)
        let screens = NSScreen.screens
        let center = CGPoint(x: current.midX, y: current.midY)
        let idx = screens.firstIndex(where: { $0.frame.contains(center) }) ?? 0
        var screen = screens[idx]
        var v = screen.visibleFrame
        var target: NSRect

        switch snap {
        case .left: target = NSRect(x: v.minX, y: v.minY, width: v.width / 2, height: v.height)
        case .right: target = NSRect(x: v.midX, y: v.minY, width: v.width / 2, height: v.height)
        case .top: target = NSRect(x: v.minX, y: v.midY, width: v.width, height: v.height / 2)
        case .bottom: target = NSRect(x: v.minX, y: v.minY, width: v.width, height: v.height / 2)
        case .topLeft: target = NSRect(x: v.minX, y: v.midY, width: v.width / 2, height: v.height / 2)
        case .topRight: target = NSRect(x: v.midX, y: v.midY, width: v.width / 2, height: v.height / 2)
        case .bottomLeft: target = NSRect(x: v.minX, y: v.minY, width: v.width / 2, height: v.height / 2)
        case .bottomRight: target = NSRect(x: v.midX, y: v.minY, width: v.width / 2, height: v.height / 2)
        case .leftThird: target = NSRect(x: v.minX, y: v.minY, width: v.width / 3, height: v.height)
        case .centerThird: target = NSRect(x: v.minX + v.width / 3, y: v.minY, width: v.width / 3, height: v.height)
        case .rightThird: target = NSRect(x: v.minX + 2 * v.width / 3, y: v.minY, width: v.width / 3, height: v.height)
        case .maximize: target = v
        case .center:
            let w = min(current.width, v.width), hh = min(current.height, v.height)
            target = NSRect(x: v.midX - w / 2, y: v.midY - hh / 2, width: w, height: hh)
        case .nextDisplay, .previousDisplay:
            guard screens.count > 1 else { return "Só tem um monitor conectado." }
            let step = snap == .nextDisplay ? 1 : screens.count - 1
            let old = v
            screen = screens[(idx + step) % screens.count]
            v = screen.visibleFrame
            // mantém a posição e o tamanho proporcionais
            let rx = (current.minX - old.minX) / old.width, ry = (current.minY - old.minY) / old.height
            let rw = current.width / old.width, rh = current.height / old.height
            target = NSRect(x: v.minX + rx * v.width, y: v.minY + ry * v.height,
                            width: min(v.width, rw * v.width), height: min(v.height, rh * v.height))
        }

        setFrame(of: window, target.integral, primaryHeight: h)
        return nil
    }

    private static func frame(of window: AXUIElement, primaryHeight h: CGFloat) -> NSRect {
        var posRef: CFTypeRef?
        var sizeRef: CFTypeRef?
        var pos = CGPoint.zero
        var size = CGSize.zero
        if AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRef) == .success, let p = posRef {
            AXValueGetValue(p as! AXValue, .cgPoint, &pos)
        }
        if AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef) == .success, let s = sizeRef {
            AXValueGetValue(s as! AXValue, .cgSize, &size)
        }
        // AX usa origem no canto superior esquerdo; NSScreen, no inferior esquerdo.
        return NSRect(x: pos.x, y: h - pos.y - size.height, width: size.width, height: size.height)
    }

    private static func setFrame(of window: AXUIElement, _ r: NSRect, primaryHeight h: CGFloat) {
        var pos = CGPoint(x: r.minX, y: h - r.maxY)
        var size = CGSize(width: r.width, height: r.height)
        guard let posV = AXValueCreate(.cgPoint, &pos), let sizeV = AXValueCreate(.cgSize, &size) else { return }
        AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeV)
        AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, posV)
        AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeV)
    }
}
