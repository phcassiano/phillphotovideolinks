import AppKit
import SwiftUI
import Combine

enum WidgetKind: String, CaseIterable, Identifiable {
    case clock, battery, system, agenda, world, habits, temps, disk, network, music, timers
    var id: String { rawValue }

    var title: String {
        switch self {
        case .clock: return "Relógio"
        case .battery: return "Bateria"
        case .system: return "Sistema (CPU e memória)"
        case .agenda: return "Agenda"
        case .world: return "Relógio mundial"
        case .habits: return "Hábitos e água"
        case .temps: return "Temperatura e ventoinha"
        case .disk: return "Disco"
        case .network: return "Rede"
        case .music: return "Música"
        case .timers: return "Timers"
        }
    }

    var key: String { "widget.\(rawValue)" }
    var height: CGFloat { [.agenda, .world, .habits, .timers].contains(self) ? 150 : 110 }
}

/// Janela que dá para arrastar clicando em qualquer parte.
final class DraggableHostingView<Content: View>: NSHostingView<Content> {
    override var mouseDownCanMoveWindow: Bool { true }
}

/// Widgets que ficam na área de trabalho, atrás das janelas.
@MainActor
final class DesktopWidgets {
    private let tools: MacTools
    private let state: AppState
    private var windows: [WidgetKind: NSPanel] = [:]
    private var bag = Set<AnyCancellable>()

    init(tools: MacTools, state: AppState) {
        self.tools = tools
        self.state = state
    }

    func refresh() {
        for kind in WidgetKind.allCases {
            let on = UserDefaults.standard.bool(forKey: kind.key)
            if on && windows[kind] == nil {
                show(kind)
            } else if !on, let w = windows[kind] {
                w.orderOut(nil)
                windows[kind] = nil
            }
        }
    }

    private func show(_ kind: WidgetKind) {
        let size = NSSize(width: 190, height: kind.height)
        let p = NSPanel(contentRect: NSRect(origin: .zero, size: size),
                        styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isOpaque = false
        p.backgroundColor = .clear
        p.hasShadow = true
        p.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
        p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        p.isMovableByWindowBackground = true
        let host = DraggableHostingView(rootView: DesktopWidgetView(kind: kind, tools: tools, state: state))
        host.sizingOptions = []
        p.contentView = host

        let d = UserDefaults.standard
        if d.object(forKey: kind.key + ".x") != nil {
            p.setFrameOrigin(NSPoint(x: d.double(forKey: kind.key + ".x"), y: d.double(forKey: kind.key + ".y")))
        } else if let v = NSScreen.main?.visibleFrame {
            let i = CGFloat(WidgetKind.allCases.firstIndex(of: kind) ?? 0)
            p.setFrameOrigin(NSPoint(x: v.maxX - 210, y: v.maxY - 60 - (i + 1) * 160))
        }
        p.orderFrontRegardless()
        windows[kind] = p

        NotificationCenter.default.publisher(for: NSWindow.didMoveNotification, object: p)
            .sink { [weak p] _ in
                guard let p else { return }
                UserDefaults.standard.set(Double(p.frame.minX), forKey: kind.key + ".x")
                UserDefaults.standard.set(Double(p.frame.minY), forKey: kind.key + ".y")
            }
            .store(in: &bag)
    }
}

struct DesktopWidgetView: View {
    let kind: WidgetKind
    @ObservedObject var tools: MacTools
    @ObservedObject var state: AppState

    var body: some View {
        content
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .environment(\.colorScheme, .dark)
    }

    @ViewBuilder
    private var content: some View {
        switch kind {
        case .clock:
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                VStack(alignment: .leading, spacing: 4) {
                    Text(Fmt.time(ctx.date))
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                    Text(Self.dayText(ctx.date))
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
            }
        case .battery:
            VStack(alignment: .leading, spacing: 6) {
                Label(tools.battery?.statusText ?? "Bateria", systemImage: tools.battery?.plugged == true ? "bolt.fill" : "battery.75")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(state.accent)
                Text("\(tools.battery?.percent ?? 0)%")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                if let b = tools.battery, b.health > 0 {
                    Text("Saúde \(b.health)% · \(b.cycles) ciclos")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }
        case .system:
            VStack(alignment: .leading, spacing: 8) {
                Label("Sistema", systemImage: "cpu")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(state.accent)
                meter("CPU", tools.cpu)
                meter("Memória", tools.memTotal > 0 ? tools.memUsed / tools.memTotal : 0)
                Text("Temperatura: \(tools.thermalText)")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
        case .agenda:
            VStack(alignment: .leading, spacing: 6) {
                Label("Agenda", systemImage: "calendar")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(state.accent)
                if tools.events.isEmpty {
                    Text(tools.agendaAllowed ? "Nada nos próximos dias 🎉" : "Permita a agenda na aba Agenda")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                } else {
                    ForEach(tools.events.prefix(3)) { e in
                        HStack(spacing: 6) {
                            Capsule().fill(e.color).frame(width: 3, height: 26)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(e.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                Text(e.allDay ? "Dia todo" : MacTools.when(e))
                                    .font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1)
                            }
                        }
                    }
                }
            }
        case .world:
            TimelineView(.periodic(from: .now, by: 30)) { ctx in
                VStack(alignment: .leading, spacing: 6) {
                    Label("Relógio mundial", systemImage: "globe")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(state.accent)
                    ForEach(tools.worldClocks.prefix(4).compactMap { ClockZone.find($0) }) { z in
                        HStack {
                            Text("\(z.flag) \(z.city)").font(.system(size: 12)).lineLimit(1)
                            Spacer()
                            Text(z.time(ctx.date)).font(.system(size: 13, weight: .semibold, design: .rounded))
                        }
                    }
                }
            }
        case .temps, .disk, .network, .music, .timers:
            moreContent
        case .habits:
            VStack(alignment: .leading, spacing: 6) {
                Label("Hábitos de hoje", systemImage: "drop.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(state.accent)
                ForEach(state.habits.prefix(4)) { h in
                    HStack {
                        Text(h.name).font(.system(size: 12)).lineLimit(1)
                        Spacer()
                        Text("\(h.count)/\(h.goal)")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(h.count >= h.goal ? state.accent : .white)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var moreContent: some View {
        switch kind {
        case .temps:
            VStack(alignment: .leading, spacing: 6) {
                Label("Temperatura", systemImage: "thermometer.medium")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(state.accent)
                Text(tools.cpuTemp.map { String(format: "%.0f °C", $0) } ?? tools.thermalText)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text(tools.fans.first.map { "Ventoinha: \(Int($0.rpm)) rpm" } ?? "Sem ventoinha")
                    .font(.system(size: 11)).foregroundColor(.secondary)
            }
        case .disk:
            let d = MacInfo.disk()
            VStack(alignment: .leading, spacing: 6) {
                Label("Disco", systemImage: "internaldrive")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(state.accent)
                Text(d.map { MacInfo.bytes($0.free) } ?? "—")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                Text("livres de \(d.map { MacInfo.bytes($0.total) } ?? "—")")
                    .font(.system(size: 11)).foregroundColor(.secondary)
            }
        case .network:
            VStack(alignment: .leading, spacing: 6) {
                Label("Rede", systemImage: "network")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(state.accent)
                Text("↓ \(MyMacTab.speed(tools.netIn))").font(.system(size: 18, weight: .bold, design: .rounded))
                Text("↑ \(MyMacTab.speed(tools.netOut))").font(.system(size: 18, weight: .bold, design: .rounded))
            }
        case .music:
            VStack(alignment: .leading, spacing: 6) {
                Label(state.nowPlaying?.app ?? "Música", systemImage: "music.note")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(state.accent)
                Text(state.nowPlaying?.title ?? "Nada tocando")
                    .font(.system(size: 15, weight: .bold)).lineLimit(2)
                Text(state.nowPlaying?.artist ?? "").font(.system(size: 11)).foregroundColor(.secondary).lineLimit(1)
            }
        default:
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                VStack(alignment: .leading, spacing: 6) {
                    Label("Timers", systemImage: "timer")
                        .font(.system(size: 11, weight: .semibold)).foregroundColor(state.accent)
                    if state.timers.isEmpty {
                        Text("Nenhum timer").font(.system(size: 12)).foregroundColor(.secondary)
                    }
                    ForEach(state.timers.prefix(3)) { t in
                        HStack {
                            Text(t.label.isEmpty ? "Timer" : t.label).font(.system(size: 12)).lineLimit(1)
                            Spacer()
                            Text(Fmt.countdown(t.end.timeIntervalSince(ctx.date)))
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                        }
                    }
                }
            }
        }
    }

    private func meter(_ label: String, _ value: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(label).font(.system(size: 11))
                Spacer()
                Text("\(Int((value * 100).rounded()))%").font(.system(size: 11, weight: .bold))
            }
            ProgressView(value: min(1, max(0, value))).tint(state.accent)
        }
    }

    static func dayText(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "EEEE, d 'de' MMMM"
        return f.string(from: d).capitalized
    }
}
