# Assistente de Seleção (plugin para Lightroom Classic, macOS)

Versão 0.3. Analisa as fotos selecionadas e marca:

| Prioridade | Problema | Cor padrão |
|---|---|---|
| 1 | Sem foco | Azul |
| 2 | Tremida (borrão de movimento) | Branco (rótulo "Tremida") |
| 3 | Olhos fechados | Verde |
| 4 | Pessoa cortada (cabeça, braço, tronco, perna/pé) | Roxo |
| 5 | Muito clara / fundo estourado | Amarelo |
| 6 | Muito escura | Vermelho |

O Lightroom só tem 5 cores de rótulo; a 6ª ("branco") é um rótulo com o nome do problema, que
aparece em branco na grade. Dá para trocar qualquer cor nas Configurações.

**Duplicadas:** fotos quase iguais tiradas em sequência (por padrão, até 3 s entre uma e outra)
viram um grupo. A melhor do grupo (mais nítida, descontando olhos fechados, tremido etc.) vai
para **Melhor da sequência**; as outras, para **Duplicada**. Opcionalmente o plugin marca as
duplicadas como rejeitadas (X) e a melhor como escolhida (bandeira). Duplicadas não recebem cor,
para não esconder os outros problemas.

Uma foto recebe **uma** cor: a do problema de maior prioridade. Além disso, cada problema vira
uma **palavra-chave** (Assistente de Seleção › …) e uma **coleção** dentro do conjunto
"Assistente de Seleção", que também tem a coleção **Para revisar** com todas as fotos marcadas.
Fotos sem problema não são alteradas.

Olhos fechados e pessoas cortadas usam o Vision, a inteligência artificial que já vem no macOS
(macOS 11 ou superior). Nada sai do computador.

## Instalação (uma vez só)

1. Instale as ferramentas da Apple (se ainda não tiver). No Terminal:
   ```
   xcode-select --install
   ```
2. Compile o programa de análise:
   ```
   cd caminho/para/lightroom-assistente-selecao
   ./helper/compilar.sh
   ```
   Deve aparecer `assistente-analise 0.3.0` e "Pronto". Ao atualizar o plugin, rode o script de novo.
3. No Lightroom Classic: **Arquivo › Gerenciador de plug-ins › Adicionar** e escolha a pasta
   `AssistenteSelecao.lrplugin`.

## Uso

1. Na Biblioteca, selecione as fotos (ou nenhuma, para analisar a tira de fotos inteira).
2. **Biblioteca › Extras do plug-in › Analisar fotos selecionadas…**
3. No final aparece o resumo. Abra a coleção **Assistente de Seleção › Para revisar** (ou a de cada
   problema), ou use o filtro por cor de rótulo.

Outros itens do menu:
- **Configurações…**: limites de cada detecção, cores e o que aplicar.
- **Limpar marcações do assistente**: desfaz o que o plugin marcou nas fotos selecionadas
  (cor, palavras-chave e coleções).

Pode rodar de novo com outros limites: o plugin troca as próprias marcações e não mexe nos
rótulos que você colocou (a não ser que "Substituir rótulos" esteja ligado).

## Calibrar (importante no começo)

Os limites padrão são um ponto de partida. A cada análise o plugin salva na Mesa um
`Assistente de Seleção AAAA-MM-DD HHhMM.csv` com os números de cada foto:

- `brilho_medio_%`: 0 = preto, 100 = branco.
- `sombras_%` / `estourado_%`: quanto da foto está quase preto / estourado.
- `nitidez`: nota dos trechos mais nítidos da foto. Fundo desfocado de propósito não derruba a nota.
- `abertura_olhos_%`: abertura do olho mais fechado entre as pessoas principais (altura ÷ largura do
  olho). Aberto fica em torno de 25–40; fechado, 5–15. Vazio = nenhum rosto grande o bastante.
- `tremor`: indício de tremido. Nítidas ficam abaixo de ~10; tremidas costumam passar de 15.
- `assinatura` / `sequencia`: a "impressão digital" da foto e o número do grupo de repetidas.
- `rostos` / `pessoas`: quantos rostos e corpos principais foram encontrados (pessoas pequenas ao
  fundo são ignoradas).
- `partes_cortadas`: cabeca, braco, tronco, perna.

Abra o CSV no Numbers/Excel, ordene pela nitidez e veja em que valor as fotos começam a ficar
inaceitáveis. Coloque esse valor em **Configurações › Sem foco**. Faça o mesmo com a abertura dos
olhos e o brilho. Se o corte acusar demais, aumente/diminua a "distância da borda" ou desligue
"pernas/pés".

## Como funciona

- O plugin (Lua) pede ao Lightroom miniaturas de 1600 px (1024 px se olhos e cortes estiverem
  desligados) **já com a revelação aplicada** e grava numa pasta temporária, 200 fotos por vez.
- O programa `assistente-analise` (Swift, roda no próprio Mac, sem internet) mede brilho,
  sombras, estouro e nitidez (Laplaciano por blocos, com contraste normalizado).
- Tremido: em cada direção (0°, 45°, 90°, 135°) compara o detalhe fino (pixels vizinhos) com o
  detalhe médio (2 px). O borrão de movimento derruba o detalhe fino só na direção do movimento,
  na foto inteira; o desfoque comum derruba igual em todas e não conta como tremido.
- Duplicadas: cada foto vira uma assinatura de 64 pontos (dHash). Fotos da mesma sequência
  diferem em até ~10; fotos diferentes, em 17 ou mais. As fotos são ordenadas pelo horário de
  captura e agrupadas quando estão perto no tempo e na assinatura.
- Olhos: o Vision encontra os rostos e o contorno de cada olho; mede-se altura ÷ largura.
- Cortes: o Vision encontra os pontos do corpo (cabeça, ombros, cotovelos, pulsos, quadris,
  joelhos, tornozelos). A pessoa é "cortada" quando o topo estimado da cabeça sai do quadro, uma
  extremidade encosta na borda, ou some e o prolongamento do membro cairia fora da foto.
- O plugin decide com base nos limites e grava cor de rótulo, palavras-chave e coleções no catálogo.
- O log fica em `~/Library/Logs/Adobe/Lightroom/LrClassicLogs/AssistenteSelecao.log`.

Fotos sem prévia gerada demoram mais, porque o Lightroom precisa renderizá-las. Gerar prévias
padrão na importação deixa a análise bem mais rápida.

## Testes (para desenvolvimento)

As medidas (nitidez, tremido, assinatura) e as regras de olhos e cortes rodam em qualquer sistema:
```
cd helper
swiftc Sources/Analise.swift Sources/Pessoas.swift Testes/main.swift -o /tmp/testes && /tmp/testes
```
A lógica do plugin (prioridades, duplicadas, cores) também, com Lua 5.1:
```
lua5.1 testes/comum_teste.lua AssistenteSelecao.lrplugin
```

## Próximos passos

- Nitidez e tremido medidos no rosto/pessoa em vez da foto inteira.
- Melhor da sequência levando em conta expressão/sorriso.
