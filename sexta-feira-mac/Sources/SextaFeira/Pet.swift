import AppKit
import SwiftUI

/// Estado do mascote que passeia pela tela.
@MainActor
final class PetState: ObservableObject {
    @Published var sleeping = false
    @Published var walking = false
    @Published var facingLeft = false
    @Published var bubble = ""
}

/// O mascote: sai da ilha, anda pela área de trabalho, segue o mouse,
/// faz comentários e cochila quando você some. Não bloqueia cliques.
@MainActor
final class DesktopPet {
    private let app: AppState
    private let pet = PetState()
    private var panel: NSPanel?
    private var tick: Timer?

    private let panelSize = CGSize(width: 240, height: 150)
    private let faceSize: CGFloat = 54

    private var pos = CGPoint(x: 400, y: 300)       // centro do rostinho, em coordenadas de tela
    private var target = CGPoint(x: 400, y: 300)
    private var lastMouse = CGPoint.zero
    private var lastMouseMove = Date()
    private var nextWander = Date()
    private var bubbleUntil = Date.distantPast
    private var nextTickle = Date()

    private let tickles = [
        "Ei, isso faz cócegas! 😆", "Tô de olho em você 👀", "Psiu, quer ajuda com algo?",
        "Esse cursor é rápido, hein!", "Me pegou! 🙈", "Bora trabalhar? 💪",
    ]
    private let idleLines = [
        "Hmm, que silêncio…", "Vou dar uma volta 🚶", "Lembrou de beber água? 💧",
        "Alongar faz bem, viu?", "Tô por aqui se precisar ✨",
    ]

    init(app: AppState) { self.app = app }

    func setEnabled(_ on: Bool) {
        if on { show() } else { hide() }
    }

    private func show() {
        guard panel == nil else { return }
        let p = NSPanel(contentRect: NSRect(origin: .zero, size: panelSize),
                        styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isOpaque = false
        p.backgroundColor = .clear
        p.hasShadow = false
        p.level = .floating
        p.ignoresMouseEvents = true
        p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        let host = NSHostingView(rootView: PetView(pet: pet, app: app, faceSize: faceSize))
        host.sizingOptions = []
        p.contentView = host

        if let s = NSScreen.main?.visibleFrame {
            pos = CGPoint(x: s.midX, y: s.maxY - 60)   // nasce perto da ilha
            target = CGPoint(x: s.midX + 120, y: s.maxY - 220)
        }
        lastMouse = NSEvent.mouseLocation
        p.setFrameOrigin(origin())
        p.orderFrontRegardless()
        panel = p
        say("Oi! Vou dar uma passeada 😄", for: 3)
        tick = every(1.0 / 30.0) { [weak self] in self?.step() }
    }

    private func hide() {
        tick?.invalidate()
        tick = nil
        panel?.orderOut(nil)
        panel = nil
    }

    private func origin() -> CGPoint {
        CGPoint(x: pos.x - panelSize.width / 2, y: pos.y - faceSize / 2)
    }

    private func say(_ text: String, for seconds: TimeInterval = 3.5) {
        pet.bubble = text
        bubbleUntil = Date().addingTimeInterval(seconds)
    }

    private func screenBounds() -> CGRect {
        let screens = NSScreen.screens
        let s = screens.first(where: { $0.frame.contains(pos) }) ?? NSScreen.main ?? screens.first
        return s?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
    }

    private func step() {
        let now = Date()
        let mouse = NSEvent.mouseLocation

        if hypot(mouse.x - lastMouse.x, mouse.y - lastMouse.y) > 2 {
            lastMouse = mouse
            lastMouseMove = now
            if pet.sleeping {
                pet.sleeping = false
                say("Opa! Cochilei 😅")
            }
        }

        let idle = now.timeIntervalSince(lastMouseMove)
        if idle > 120 {
            if !pet.sleeping { pet.sleeping = true; pet.bubble = "" }
            if pet.walking { pet.walking = false }
            return
        }

        let bounds = screenBounds()
        let distMouse = hypot(mouse.x - pos.x, mouse.y - pos.y)

        if idle < 4 {
            // segue o mouse, mas sem grudar
            target = distMouse > 120 ? mouse : pos
            if distMouse < 40 && now >= nextTickle {
                say(tickles.randomElement() ?? "")
                nextTickle = now.addingTimeInterval(10)
            }
        } else if now >= nextWander {
            target = CGPoint(x: .random(in: (bounds.minX + 60)...(bounds.maxX - 60)),
                             y: .random(in: (bounds.minY + 40)...(bounds.maxY - 120)))
            nextWander = now.addingTimeInterval(.random(in: 5...10))
            if Int.random(in: 0..<5) == 0 { say(idleLines.randomElement() ?? "") }
        }

        let dx = target.x - pos.x
        let dy = target.y - pos.y
        let d = hypot(dx, dy)
        let speed: CGFloat = idle < 4 ? 4.5 : 1.6
        let moving = d > speed
        if moving {
            pos.x += dx / d * speed
            pos.y += dy / d * speed
            pos.x = min(max(pos.x, bounds.minX + 30), bounds.maxX - 30)
            pos.y = min(max(pos.y, bounds.minY + 30), bounds.maxY - 30)
            let left = dx < 0
            if abs(dx) > 1 && left != pet.facingLeft { pet.facingLeft = left }
        }
        if moving != pet.walking { pet.walking = moving }
        panel?.setFrameOrigin(origin())

        if now > bubbleUntil && !pet.bubble.isEmpty { pet.bubble = "" }
    }
}

struct PetView: View {
    @ObservedObject var pet: PetState
    @ObservedObject var app: AppState
    let faceSize: CGFloat

    var body: some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)
            let text = app.mode != .idle && !app.pillText.isEmpty ? app.pillText : pet.bubble
            if !text.isEmpty {
                Text(text)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.black.opacity(0.85)))
                    .frame(maxWidth: 220)
            }
            if pet.sleeping {
                Text("z z z")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(.white.opacity(0.75))
            }
            RobotFace(mode: app.mode, size: faceSize, accent: app.accent,
                      asleep: pet.sleeping, bouncing: pet.walking)
                .scaleEffect(x: pet.facingLeft ? -1 : 1, y: 1)
                .shadow(color: .black.opacity(0.35), radius: 4, y: 2)
        }
        .frame(width: 240, height: 150, alignment: .bottom)
        .environment(\.colorScheme, .dark)
    }
}
