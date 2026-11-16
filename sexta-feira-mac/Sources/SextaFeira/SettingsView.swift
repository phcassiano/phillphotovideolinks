import SwiftUI
import AppKit
import AVFoundation

struct SettingsView: View {
    let assistant: Assistant

    @AppStorage("assistantName") private var assistantName = "Sexta-feira"
    @AppStorage("userName") private var userName = ""
    @AppStorage("accent") private var accent = 0
    @AppStorage("provider") private var provider = "gemini"
    @AppStorage("geminiModel") private var geminiModel = Prefs.defaultGemini
    @AppStorage("claudeModel") private var claudeModel = Prefs.defaultClaude
    @AppStorage("ollamaModel") private var ollamaModel = Prefs.defaultOllama
    @AppStorage("ollamaURL") private var ollamaURL = Prefs.defaultOllamaURL
    @AppStorage("speakReplies") private var speakReplies = true
    @AppStorage("wakeEnabled") private var wakeEnabled = false
    @AppStorage("voiceID") private var voiceID = ""
    @AppStorage("personality") private var personality = "divertido"
    @AppStorage("petEnabled") private var petEnabled = true
    @AppStorage("waterReminder") private var waterReminder = false
    @AppStorage("pixKey") private var pixKey = ""
    @AppStorage("imageModel") private var imageModel = Prefs.defaultImageModel
    @AppStorage("windowHotkeys") private var windowHotkeys = true
    @AppStorage("privacyWatch") private var privacyWatch = true
    @AppStorage("chargeAlert") private var chargeAlert = true
    @AppStorage("widget.clock") private var wClock = false
    @AppStorage("widget.battery") private var wBattery = false
    @AppStorage("widget.system") private var wSystem = false
    @AppStorage("widget.agenda") private var wAgenda = false
    @AppStorage("widget.world") private var wWorld = false
    @AppStorage("widget.habits") private var wHabits = false
    @AppStorage("widget.temps") private var wTemps = false
    @AppStorage("widget.disk") private var wDisk = false
    @AppStorage("widget.network") private var wNetwork = false
    @AppStorage("widget.music") private var wMusic = false
    @AppStorage("widget.timers") private var wTimers = false
    @AppStorage("menuBarClean") private var menuBarClean = false

    @State private var geminiKey = Keychain.get("gemini")
    @State private var claudeKey = Keychain.get("claude")
    @State private var testResult = ""
    @State private var testing = false

    var body: some View {
        Form {
            identitySection
            extrasSection
            toolsSection
            brainSection
            voiceSection
            dataSection
        }
        .formStyle(.grouped)
        .frame(width: 560, height: 700)
        .onChange(of: geminiKey) { Keychain.set($0, for: "gemini") }
        .onChange(of: claudeKey) { Keychain.set($0, for: "claude") }
        .onChange(of: wakeEnabled) { _ in assistant.applyPrefs() }
        .onChange(of: assistantName) { _ in assistant.applyPrefs() }
        .onChange(of: userName) { _ in assistant.applyPrefs() }
        .onChange(of: accent) { _ in assistant.applyPrefs() }
        .onChange(of: petEnabled) { _ in assistant.applyPrefs() }
        .onChange(of: waterReminder) { _ in assistant.applyPrefs() }
        .onChange(of: wClock) { _ in assistant.applyPrefs() }
        .onChange(of: wBattery) { _ in assistant.applyPrefs() }
        .onChange(of: wSystem) { _ in assistant.applyPrefs() }
        .onChange(of: wAgenda) { _ in assistant.applyPrefs() }
        .onChange(of: wWorld) { _ in assistant.applyPrefs() }
        .onChange(of: wHabits) { _ in assistant.applyPrefs() }
        .onChange(of: wTemps) { _ in assistant.applyPrefs() }
        .onChange(of: wDisk) { _ in assistant.applyPrefs() }
        .onChange(of: wNetwork) { _ in assistant.applyPrefs() }
        .onChange(of: wMusic) { _ in assistant.applyPrefs() }
        .onChange(of: wTimers) { _ in assistant.applyPrefs() }
        .onChange(of: menuBarClean) { _ in assistant.applyPrefs() }
        .onDisappear { assistant.applyPrefs() }
    }

    private var identitySection: some View {
        Section("Identidade") {
            TextField("Nome da assistente", text: $assistantName)
            TextField("Seu nome", text: $userName)
            Picker("Cor", selection: $accent) {
                ForEach(0..<Palette.colors.count, id: \.self) { i in
                    Text(Palette.names[i]).tag(i)
                }
            }
        }
    }

    private var extrasSection: some View {
        Section("Jeito e extras") {
            Picker("Personalidade", selection: $personality) {
                ForEach(Personality.all.indices, id: \.self) { i in
                    Text(Personality.all[i].title).tag(Personality.all[i].id)
                }
            }
            Toggle("Mascote passeando pela tela", isOn: $petEnabled)
            Toggle("Lembrar de beber água (de hora em hora, 8h–22h)", isOn: $waterReminder)
            TextField("Sua chave Pix (para “copia meu pix”)", text: $pixKey)
            TextField("Modelo para criar imagens (Gemini)", text: $imageModel)
            Text("Criar artes usa a chave do Gemini, mesmo que o cérebro seja outro. Pode ter custo dependendo da sua conta.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var toolsSection: some View {
        Section("Ferramentas do Mac") {
            Toggle("Atalhos de janela (⌃⌥ setas, ⌃⌥↩ tela cheia, ⌃⌥⌘ setas troca de monitor)", isOn: $windowHotkeys)
            Toggle("Vigia: avisar quando um app ligar câmera ou microfone", isOn: $privacyWatch)
            Toggle("Avisar quando a bateria chegar no limite de carga", isOn: $chargeAlert)
            Text("⌃⌥V abre o histórico de copiados de qualquer lugar.")
                .font(.caption)
                .foregroundColor(.secondary)
            Text("Widgets na área de trabalho (arraste para posicionar):")
                .font(.caption)
            Toggle("Relógio", isOn: $wClock)
            Toggle("Bateria", isOn: $wBattery)
            Toggle("Sistema (CPU e memória)", isOn: $wSystem)
            Toggle("Agenda", isOn: $wAgenda)
            Toggle("Relógio mundial", isOn: $wWorld)
            Toggle("Hábitos e água", isOn: $wHabits)
            Toggle("Temperatura e ventoinha", isOn: $wTemps)
            Toggle("Disco", isOn: $wDisk)
            Toggle("Rede", isOn: $wNetwork)
            Toggle("Música", isOn: $wMusic)
            Toggle("Timers", isOn: $wTimers)
            Toggle("Barra de menus limpa (esconde os ícones à esquerda do │)", isOn: $menuBarClean)
            Text("Para escolher o que esconder, segure ⌘ e arraste os ícones da barra para a esquerda do │.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var brainSection: some View {
        Section("Cérebro (IA)") {
            Picker("Usar", selection: $provider) {
                Text("Gemini (Google) — tem cota grátis").tag("gemini")
                Text("Claude (Anthropic)").tag("claude")
                Text("Local no Mac (Ollama, offline)").tag("local")
            }

            if provider == "gemini" {
                SecureField("Chave da API do Gemini", text: $geminiKey)
                TextField("Modelo", text: $geminiModel)
                Link("Pegar uma chave grátis no Google AI Studio",
                     destination: URL(string: "https://aistudio.google.com/apikey")!)
            }

            if provider == "claude" {
                SecureField("Chave da API do Claude", text: $claudeKey)
                Picker("Modelo", selection: $claudeModel) {
                    Text("Claude Opus 5.5 — mais inteligente").tag("claude-opus-5-5")
                    Text("Claude Sonnet 5.5 — equilibrado").tag("claude-sonnet-5-5")
                    Text("Claude Haiku 5.5 — mais rápido e barato").tag("claude-haiku-5-5")
                }
                Link("Criar uma chave no Claude Console",
                     destination: URL(string: "https://platform.claude.com/settings/keys")!)
            }

            if provider == "local" {
                TextField("Endereço do Ollama", text: $ollamaURL)
                TextField("Modelo", text: $ollamaModel)
                Text("Instale o Ollama (ollama.com) e rode no Terminal:  ollama pull \(ollamaModel)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .textSelection(.enabled)
            }

            HStack(alignment: .top) {
                Button(testing ? "Testando…" : "Testar IA", action: test)
                    .disabled(testing)
                Text(testResult)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(4)
            }
        }
    }

    private var voiceSection: some View {
        Section("Voz") {
            Toggle("Responder em voz alta", isOn: $speakReplies)
            Picker("Voz", selection: $voiceID) {
                Text("Automática").tag("")
                ForEach(Speaker.ptVoices(), id: \.identifier) { v in
                    Text("\(v.name) (\(v.language))").tag(v.identifier)
                }
            }
            Toggle("Sempre ouvindo: diga “\(assistantName)” + o pedido", isOn: $wakeEnabled)
            Text("Segure ⌥ Espaço para falar a qualquer momento. Um toque rápido em ⌥ Espaço abre a caixa de texto.")
                .font(.caption)
                .foregroundColor(.secondary)
            Text("Dica: para uma voz bem mais natural, baixe uma voz “Aprimorada” ou “Premium” de Português (Brasil) em Ajustes do Sistema › Acessibilidade › Conteúdo Falado › Voz do Sistema › Gerenciar Vozes.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var dataSection: some View {
        Section("Seus dados") {
            Text("Tarefas, memória e notas ficam só no seu Mac. As chaves de API ficam no Keychain.")
                .font(.caption)
                .foregroundColor(.secondary)
            Button("Abrir pasta de dados (notas.md, tarefas, memória)") {
                NSWorkspace.shared.open(Storage.dir)
            }
            Button("Sair da Sexta-feira") {
                NSApp.terminate(nil)
            }
        }
    }

    private func test() {
        testing = true
        testResult = ""
        Keychain.set(geminiKey, for: "gemini")
        Keychain.set(claudeKey, for: "claude")
        Task { @MainActor in
            do {
                let raw = try await AIClient.complete(
                    system: "Responda só com JSON no formato {\"say\": \"...\", \"actions\": []}.",
                    turns: [ChatTurn(role: "user", text: "Diga oi em uma frase curta, em português.")])
                testResult = "✅ " + ReplyParser.parse(raw).say
            } catch {
                testResult = "❌ " + error.localizedDescription
            }
            testing = false
        }
    }
}
