# Sexta-feira — assistente de IA no topo da tela do Mac

Uma "ilha" preta no centro da barra de menus. Passe o mouse e ela abre com conversa,
tarefas, timers, memória e controle de música. Fale com ela segurando **⌥ Espaço**
ou, se quiser, dizendo **"Sexta-feira, …"**.

Feita em Swift/SwiftUI nativo: leve, sem Electron e só para o seu Mac.

## O que ela faz

| Peça assim | O que acontece |
|---|---|
| "abre o Spotify" / "fecha o Safari" | abre ou fecha apps |
| "toca Henrique e Juliano" | abre a busca no Spotify |
| "pausa", "próxima", "anterior" | controla Spotify ou Música |
| "volume 40", "aumenta o volume" | volume do Mac |
| "timer de 10 minutos pra pizza" | timer na ilha + aviso sonoro |
| "me lembra de ligar pro cliente em 30 minutos" | lembrete falado + notificação |
| "cria a tarefa mandar proposta" | lista de tarefas |
| "anota que preciso comprar café" | salva em `notas.md` |
| "lembra que eu prefiro respostas curtas" | memória permanente |
| "quanto é 15% de 230?", "me explica X" | conversa com a IA |
| "abre o YouTube", "pesquisa o clima amanhã" | abre o site ou a pesquisa |
| "roda o atalho Modo Foco" | roda um atalho do app Atalhos |

Os comandos simples (abrir app, música, volume, timer, lembrete, tarefa, nota) funcionam
**sem IA e sem internet**. O resto vai para a IA que você escolher.

## Instalar (uma vez)

1. Instale as ferramentas da Apple. Abra o **Terminal** e rode:
   ```bash
   xcode-select --install
   ```
   Não precisa do Xcode completo.

2. Baixe esta pasta (`sexta-feira-mac`) para o Mac e, no Terminal:
   ```bash
   cd caminho/para/sexta-feira-mac
   ./build.sh --install
   ```
   Isso compila, copia para **Aplicativos** e abre.

3. Na primeira vez abre a tela de **Configurações**:
   - **Seu nome** e a **cor** da assistente.
   - **Cérebro (IA)**:
     - **Gemini**: pegue uma chave grátis em https://aistudio.google.com/apikey e cole.
     - **Claude**: crie uma chave em https://platform.claude.com/settings/keys (é pago por uso).
       O *Haiku 5.5* é o mais rápido e barato; o *Opus 5.5* é o mais inteligente.
     - **Local**: veja abaixo.
   - Clique em **Testar IA**.

4. O macOS vai pedir permissões. Aceite:
   - **Microfone** e **Reconhecimento de Fala**, para ouvir você.
   - **Automação** (Spotify/Música/System Events), para controlar música e volume.
   - **Notificações**, para timers e lembretes.

5. Para abrir sozinha ao ligar o Mac: **Ajustes do Sistema › Geral › Itens de Início**,
   adicione **Sexta-feira**.

## IA local (offline e grátis)

1. Instale o Ollama: https://ollama.com/download
2. No Terminal:
   ```bash
   ollama pull qwen2.5:7b      # Mac com 16 GB de RAM
   # ou
   ollama pull qwen2.5:3b      # Mac com 8 GB de RAM (mais leve)
   ```
3. Em Configurações › Cérebro, escolha **Local** e use o mesmo nome de modelo.

## Como usar

- **Passe o mouse** na ilha para abrir. Ela fecha sozinha quando você tira o mouse.
  O 📌 deixa ela aberta.
- **Segure ⌥ Espaço** e fale. Solte para enviar.
- **Toque rápido em ⌥ Espaço** para abrir a caixa de texto. **Esc** fecha.
- **"Sempre ouvindo"** (opcional, em Configurações): diga *"Sexta-feira, abre o Spotify"*.
  O reconhecimento roda no próprio Mac. A bolinha laranja de microfone fica acesa enquanto ela escuta.
- Uma voz mais natural: **Ajustes do Sistema › Acessibilidade › Conteúdo Falado ›
  Voz do Sistema › Gerenciar Vozes**. Baixe uma voz *Aprimorada* ou *Premium* de Português (Brasil)
  e escolha ela em Configurações › Voz.
- Ela some sozinha em apps de **tela cheia** (jogos, vídeos).
- O ícone 🙂 na barra de menus tem as opções **Configurações** e **Sair**.

## Onde ficam seus dados

`~/Library/Application Support/SextaFeira/`: `tarefas.json`, `memoria.json` e `notas.md`.
As chaves de API ficam no **Keychain**. Tem um botão para abrir essa pasta em Configurações.

## Atualizar depois de mudar o código

```bash
./build.sh --install
```

Depois de recompilar, o macOS pode pedir a senha do Keychain ou as permissões de novo,
porque o app é assinado localmente. Clique em **Sempre permitir**.

## Limitações atuais

- "Toca X" **abre a busca** no Spotify. O Spotify não deixa outro app iniciar uma música
  pelo nome, então você dá o play.
- A palavra de ativação usa o reconhecimento de fala da Apple. Funciona bem em ambiente
  silencioso, mas não é tão precisa quanto um detector dedicado.
- Clima, notícias e cotações abrem uma pesquisa no navegador, em vez de a IA responder com os dados.

## Estrutura do código

| Arquivo | Função |
|---|---|
| `App.swift` | início do app, atalho ⌥ Espaço, ícone na barra de menus |
| `Notch.swift` | janela flutuante no topo, hover, atalho global |
| `Views.swift` | ilha recolhida/aberta, rostinho animado, abas |
| `SettingsView.swift` | tela de configurações |
| `Assistant.swift` | "cérebro": fluxo de pedido, prompt da IA, respostas |
| `AI.swift` | Gemini, Claude e Ollama |
| `Voice.swift` | reconhecimento de voz (pt-BR) e fala |
| `Actions.swift` | ações, comandos rápidos e leitura da resposta da IA |
| `MacControl.swift` | apps, música, volume, notificações, timers |
