# Pulso Lab (Windows)

Limpa, otimiza e cuida da saúde do PC. Grátis e sem anúncios.

Feito com [Tauri 2](https://tauri.app) (Rust) + React/TypeScript. A especificação completa está em
[`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).

## Versão 0.1 (atual)

- Janela com menu lateral (todas as seções do plano), tema escuro e claro.
- **Painel** com dados reais: nota de saúde (parcial), espaço no disco do Windows, uso de memória RAM
  (atualiza a cada 3 s), tempo ligado, nome do Windows com edição e build, e processador.
- "Resolver" leva à tela certa; "Ignorar" tira o item da nota.
- As outras telas mostram o que vão fazer e em qual versão chegam.

## Como baixar o instalador

A cada push que altera a pasta `pulso-lab/`, o GitHub gera o instalador sozinho:
**Actions → "Pulso Lab: gerar instalador do Windows" → execução mais recente → Artifacts →
`Pulso-Lab-Windows`**. É um `.zip` com o `Pulso Lab_0.1.0_x64-setup.exe`.

Como o app ainda não tem assinatura digital, o Windows pode mostrar "O Windows protegeu o computador".
Clique em **Mais informações → Executar assim mesmo**.

## Desenvolver no Mac

Pré-requisitos: [Node.js 22+](https://nodejs.org), [Rust](https://rustup.rs) e as ferramentas de
linha de comando do Xcode (`xcode-select --install`).

```bash
cd pulso-lab
npm install
npm run dev          # só a interface, no navegador (http://localhost:1420), com dados de exemplo
npm run tauri dev    # o app de verdade numa janela (no Mac, mostra os dados do Mac)
```

O que só existe no Windows (registro, winget, limpeza etc.) é testado no instalador gerado pelo GitHub,
numa máquina virtual com Windows 11 (UTM ou Parallels) ou num PC.

## Estrutura

```
pulso-lab/
├── src/                 interface (React)
│   ├── pages/           telas (Painel, EmBreve…)
│   ├── components/      peças reutilizáveis (anel de nota, menu lateral)
│   ├── nav.ts           menu e plano de cada tela
│   ├── health.ts        verificações e cálculo da nota
│   └── api.ts           chamadas ao backend (e dados de exemplo no navegador)
├── src-tauri/           backend (Rust)
│   └── src/system.rs    leitura de RAM, CPU, disco, uptime e versão do Windows
└── docs/                especificação e telas de referência
```
