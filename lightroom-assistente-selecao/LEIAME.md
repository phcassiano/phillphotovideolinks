# Assistente de Seleção (plugin para Lightroom Classic, macOS)

Versão inicial (MVP). Analisa as fotos selecionadas e marca:

| Problema | Cor padrão | Palavra-chave |
|---|---|---|
| Muito escura | Vermelho | Assistente de Seleção › Muito escura |
| Muito clara / fundo estourado | Amarelo | Assistente de Seleção › Muito clara |
| Sem foco | Azul | Assistente de Seleção › Sem foco |

Uma foto recebe **uma** cor (prioridade: escura → clara → sem foco), mas pode receber **várias**
palavras-chave. Fotos sem problema não são alteradas.

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
   Deve aparecer `assistente-analise 0.1.0` e "Pronto".
3. No Lightroom Classic: **Arquivo › Gerenciador de plug-ins › Adicionar** e escolha a pasta
   `AssistenteSelecao.lrplugin`.

## Uso

1. Na Biblioteca, selecione as fotos (ou nenhuma, para analisar a tira de fotos inteira).
2. **Biblioteca › Extras do plug-in › Analisar fotos selecionadas…**
3. No final aparece o resumo. Use o filtro por cor de rótulo (ou a palavra-chave) para ver cada grupo.

Outros itens do menu:
- **Configurações…**: limites de cada detecção, cores e o que aplicar.
- **Limpar marcações do assistente**: desfaz o que o plugin marcou nas fotos selecionadas.

Pode rodar de novo com outros limites: o plugin troca as próprias marcações e não mexe nos
rótulos que você colocou (a não ser que "Substituir rótulos" esteja ligado).

## Calibrar (importante no começo)

Os limites padrão são um ponto de partida. A cada análise o plugin salva na Mesa um
`Assistente de Seleção AAAA-MM-DD HHhMM.csv` com os números de cada foto:

- `brilho_medio_%`: 0 = preto, 100 = branco.
- `sombras_%` / `estourado_%`: quanto da foto está quase preto / estourado.
- `nitidez`: nota dos trechos mais nítidos da foto. Fundo desfocado de propósito não derruba a nota.

Abra o CSV no Numbers/Excel, ordene pela nitidez e veja em que valor as fotos começam a ficar
inaceitáveis. Coloque esse valor em **Configurações › Sem foco**. Faça o mesmo com o brilho.

## Como funciona

- O plugin (Lua) pede ao Lightroom miniaturas de 1024 px **já com a revelação aplicada** e grava
  numa pasta temporária, 200 fotos por vez.
- O programa `assistente-analise` (Swift, roda no próprio Mac, sem internet) mede brilho,
  sombras, estouro e nitidez (Laplaciano por blocos, com contraste normalizado).
- O plugin decide com base nos limites e grava cor de rótulo e palavras-chave no catálogo.
- O log fica em `~/Library/Logs/Adobe/Lightroom/LrClassicLogs/AssistenteSelecao.log`.

Fotos sem prévia gerada demoram mais, porque o Lightroom precisa renderizá-las. Gerar prévias
padrão na importação deixa a análise bem mais rápida.

## Próximos passos

- Olhos fechados e pessoas cortadas (Apple Vision: pontos do rosto e do corpo).
- Fotos tremidas (borrão de movimento numa direção).
- Duplicadas e melhor foto de cada sequência.
- Nitidez medida no rosto/pessoa em vez da foto inteira.
