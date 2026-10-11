# Nota do CFO (leia primeiro)

> Todos os valores estão em **reais**; o relatório usa o símbolo "$" porque a ferramenta é genérica. Como é assinatura, a ferramenta foi configurada com **1 "dia" = 1 mês**: onde se lê "a day", leia "por mês", e "casal pagante-mês a day" = **casais pagantes ativos**. Não é conselho financeiro, fiscal ou jurídico; um contador deve confirmar a estrutura (ME no Simples, CNAE e Fator R) antes de mexer em dinheiro.

- **A margem:** cada casal pagante deixa **R$ 5,69 por mês** (76% do preço médio de R$ 7,46) depois da taxa da loja, do imposto e do servidor. O produto em si é barato de entregar.
- **O ponto de equilíbrio:** **486 casais pagantes** cobrem os R$ 2.764/mês de custo fixo. No plano (800 pagantes) a margem é de 30%.
- **A linha a observar:** o pró-labore. Sem ele (o fundador vive de outra renda no início), o equilíbrio cai para **201 casais** e o ano 1 fica **positivo em R$ 5.516** na operação. Nenhum outro ajuste testado mexe tanto.
- **O que o ramp exige:** 700 pagantes no mês 12. Com conversão típica de grátis para pago de 2% a 5% (benchmarks de apps de assinatura), isso significa **14 mil a 35 mil casais ativos**. O painel simulado não converteu ninguém, então este ramp é otimista até um teste real dizer o contrário.
- **Caixa:** no plano base o fundador precisa de **R$ 33.145** antes de virar. Sem o freelancer (o fundador transforma o protótipo com ferramentas próprias) cai para **R$ 21.144**; sem pró-labore, **R$ 21.101**.
- **Três formas de melhorar a margem (rodadas na ferramenta):**
  1. Adiar o pró-labore: equilíbrio de 486 para **201** casais; ano 1 de -R$ 13.936 para **+R$ 5.516**.
  2. Anual a R$ 89,90 em vez de R$ 69,90 (preço médio R$ 8,45): equilíbrio para **428**; ano 1 para -R$ 11.299.
  3. Cortar os R$ 12.000 do freelancer: caixa necessário de R$ 33.145 para **R$ 21.144** (o equilíbrio não muda).
- **Condições do conselho sobre dinheiro:** não atendidas ainda. Falta testar o preço com intenção real (pré-venda) e medir o custo para trazer um casal.

---

# Unit economics: Nós Dois (valores em R$; 'dia' = mês, ver cfo-sources.md)

Every number below comes from the input file. Nothing is looked up or guessed.

## One casal pagante-mês

| line | per casal pagante-mês |
| --- | ---: |
| Price | $7.46 |
| Taxa da loja (15% de R$ 7,46) | -$1.12 |
| Imposto Simples Nacional, Anexo III com Fator R (6%) | -$0.45 |
| Servidor e banco de dados por casal (estimativa) | -$0.20 |
| **Contribution** (what each casal pagante-mês leaves to pay the fixed costs) | **$5.69** (76%) |

## The margin that matters

Fixed costs: $2,764 a month (Pró-labore do fundador (1 salário mínimo 2026) $1,621, Contador (estimativa) $400, Supabase Pro (US$ 25 × R$ 5,50) $138, Apple Developer (US$ 99/ano ÷ 12 × R$ 5,50) $45, Domínio, e-mail e ferramentas (estimativa) $60, Anúncios de teste (estimativa) $500).

- **Break-even: 486 casal pagante-mêss a day.** Below that you lose money every month.
- **Profit margin at your plan** (800 a day): **30%** of every sale, after every cost.

## Year 1, month by month

| month | casal pagante-mêss a day | revenue | profit | cumulative (after $17,088 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$2,764 | -$19,852 |
| 2 | 20 | $149 | -$2,650 | -$22,502 |
| 3 | 50 | $373 | -$2,480 | -$24,982 |
| 4 | 90 | $671 | -$2,252 | -$27,234 |
| 5 | 140 | $1,044 | -$1,967 | -$29,201 |
| 6 | 200 | $1,492 | -$1,626 | -$30,827 |
| 7 | 270 | $2,014 | -$1,228 | -$32,055 |
| 8 | 350 | $2,611 | -$772 | -$32,827 |
| 9 | 430 | $3,208 | -$317 | -$33,145 |
| 10 | 520 | $3,879 | $195 | -$32,950 |
| 11 | 610 | $4,551 | $707 | -$32,243 |
| 12 | 700 | $5,222 | $1,219 | -$31,024 |

- **Year 1 operating profit: -$13,936** on $25,215 of revenue.
- After the $17,088 startup spend: -$31,024.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$33,145**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 30% | 486 | -$13,936 |
| Price -10% | 22% | 560 | -$16,457 |
| Volume -20% | 18% | 486 | -$17,782 |
| Unit costs +15% | 26% | 510 | -$14,833 |

## Red flags

- Year 1 loses money on operations (-$13,936).
- The startup spend is not earned back within year 1.
