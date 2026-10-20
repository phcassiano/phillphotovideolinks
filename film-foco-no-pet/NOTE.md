# Foco no Pet · "O obturador" (motionmaxxing)

Vertical 1080×1920, 30 fps, 16 s. Arquivos: `final.mp4`, `index.html` (editável), `STORYBOARD.md`.

## A ideia
O obturador da logo (6 lâminas grafite com a pata laranja) é o único corte especial do filme. As lâminas fecham sobre a foto ruim de celular, ouve-se o clique, e elas abrem no golden nítido olhando pra câmera. No fim, o obturador fecha de novo e o clique produz a marca. Se você cobrir a logo, a ideia deixa de funcionar para um concorrente, porque o gesto central é dela.

## Beats (o que cada um compra)
| f | Papel | Compra |
|---|---|---|
| 0–90 | hook: "Ele nunca olha / pro celular." sobre o golden borrado e escuro | o tutor se reconhece |
| 90–156 | turn: o obturador abre, "Pra gente, ele **olha**." (laranja = o pet olhou) | a Foco no Pet consegue o olhar |
| 156–372 | proof: 8 planos reais de 0,9 s; a frase "Fundo colorido, luz de estúdio, no Parque dos Jequitibás." atravessa os cortes | é real e é pra todo cão |
| 372–447 | cta: cane corso olhando; "Domingo, a partir das 7h." → "Chama no WhatsApp (61) 99989-0604"; o obturador fecha | dá pra ir e é só chamar |
| 447–480 | a logo chega de 3,2× e encolhe até o fim | assinatura |

## O que é real e o que é ilustrativo
- Real: as fotos dos ensaios (p00, p02, p04, p10, p11, p12), a logo (PNG) e os dados (Parque dos Jequitibás, a partir das 7h, WhatsApp).
- Gerados pelo Veo a partir das fotos reais: os clipes p01, p04, p13, fala-p05 e fala-p12.
- Ilustrativo: a foto "de celular" do gancho é a p11 degradada de propósito (borrada e escura).
- Inventado: nada. Não há preço, vagas nem números.

## Enquadramento
As fotos 1080×1290 aparecem inteiras no topo, sobre uma cópia desfocada delas mesmas. Todo texto fica na faixa de baixo, sobre o fundo desfocado, e nunca no rosto. Nenhuma cabeça ou orelha fica cortada (conferido nos stills de todos os planos).

## Gates
Valores impressos por `look.py` (final.mp4) e `lint.mjs`:

| Gate | Resultado | Números |
|---|---|---|
| G0 | PASS | 16,00 s (esperado 16,00); áudio presente |
| G2 | PASS | nenhuma sequência de mais de 3 quadros vazios |
| G3 | PASS | fim parado 0,00 s (termina em movimento: a logo encolhendo); último plano 1,10 s = 7 % do filme |
| G5 | PASS | todos os itens C1–C7, D1, P1, T1 e V1–V5 |
| G1 / G4 | por olho, sem número de script | não há UI no filme; um pet por quadro em todos os 16 quadros da folha |

Áudio: −15,8 LUFS integrado, true peak −2,2 dBFS.

## Folha de contato (um quadro a cada 1 s)
1. **0,5–2,5 s:** golden borrado e escuro no topo; as palavras do gancho sobem embaixo. Parece foto de celular, não slide.
2. **3,5 s:** o golden nítido logo depois de as lâminas abrirem, com a coleira vermelha atrás.
3. **4,5 s:** o mesmo golden olhando, com "Pra gente, ele olha." e o "olha" em laranja.
4. **5,5–11,5 s:**
   - pomerânia de óculos, fundo azul;
   - vira-lata malhado de camiseta rosa;
   - cane corso deitado;
   - pomerânia de laço verde;
   - cane corso em close;
   - shih tzu;
   - shih tzu de camisa havaiana;
   - golden.

   Um pet por quadro e a frase embaixo.
5. **12,5–14,5 s:** cane corso em vídeo, com "Domingo, a partir das 7h." e depois o WhatsApp.
6. **15,5 s:** a logo e o wordmark sobre creme, encolhendo.

## Som
Não há chave da ElevenLabs, então o filme não tem voz nem música da skill. Os efeitos foram sintetizados (`audio/mix-final.wav`):
- ambiente de ar no gancho, que some antes do primeiro clique;
- clique de obturador aos 2,96 s e aos 14,8 s;
- um pad leve a partir da abertura;
- tiques suaves nos cortes da prova;
- "pop" na pata aos 15,07 s.

## O que eu ainda melhoraria
- O movimento médio fica abaixo da faixa humana (luma 3,9 contra a mediana de 6,8). O gancho está segurado de propósito, mas a prova poderia ter mais deriva de câmera.
- Uma trilha de verdade (ElevenLabs ou música licenciada) daria mais energia.
- Só 2 de 14 cortes caem em cima de um som. Dá para alinhar mais os tiques.
