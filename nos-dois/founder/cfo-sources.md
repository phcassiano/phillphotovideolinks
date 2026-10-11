# De onde vêm os números do CFO

| Número | Valor | Fonte ou raciocínio |
|---|---|---|
| Preço médio por casal-mês | R$ 7,46 | **Estimativa:** 60% no anual (R$ 69,90 ÷ 12 = R$ 5,83) e 40% no mensal (R$ 9,90), de `pricing.md`. O mix é chute; vários compradores do painel disseram preferir o anual. |
| Taxa da loja | 15% | Google Play: assinaturas com 15% efetivo (10% de serviço + 5% de cobrança na mudança de 2026) — [Google Play Console](https://support.google.com/googleplay/android-developer/answer/112622?hl=en), [Adapty](https://adapty.io/blog/google-play-billing-changes-subscriptions-fees). Apple: 15% no Small Business Program — [Adapty PT](https://adapty.io/pt/blog/app-store-small-business-program/). |
| Imposto | 6% | Simples Nacional Anexo III com Fator R ≥ 28% (sem isso, Anexo V a partir de 15,5%). Desenvolvimento de software não pode ser MEI — [Contabilidade.com](https://contabilidade.com/blog/cnae-6201501-desenvolvimento-de-programas-de-computador-sob-encomenda-simples-nacional-fator-r-e-abertura-de-empresa/), [Agilize](https://agilize.com.br/artigos/?p=5043). Confirmar o CNAE certo para app por assinatura com o contador. |
| Servidor por casal | R$ 0,20 | **Estimativa.** O plano Pro do Supabase inclui 100 mil usuários ativos por mês; o custo marginal por casal é pequeno até lá. |
| Pró-labore | R$ 1.621 | Salário mínimo de 2026 — [SBT News](https://sbtnews.sbt.com.br/noticia/brasil/lula-assina-decreto-que-estabelece-salario-minimo-em-r-1-621-a-partir-de-1-de-janeiro-de-2026). Necessário para o Fator R. |
| Contador | R$ 400/mês | **Estimativa**; pedir 3 orçamentos. |
| Supabase Pro | US$ 25/mês | [MakerKit](https://makerkit.dev/blog/md/saas/supabase-pricing), [Jetadmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/). Computação extra pode levar a US$ 60+. |
| Apple Developer | US$ 99/ano | Valor público conhecido do programa; confirmar em reais no site da Apple. |
| Câmbio | R$ 5,50/US$ | **Estimativa.** |
| Conta Google Play | US$ 25 uma vez | Valor público conhecido; confirmar no Play Console. |
| Freelancer, abertura de empresa, logo, INPI, anúncios | ver `numbers.json` | **Estimativas**; pedir orçamentos. |
| Ramp de pagantes | 0 → 700 em 12 meses | **Estimativa otimista.** Conversão grátis→pago de ~2% a 5% em apps de assinatura — [RevenueCat 2025](https://revenuecat.com/state-of-subscription-apps-2025), [SaaStr](https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps/). O painel simulado deu 0%. Mês 1 é zero porque os 30 dias de teste grátis adiam a primeira cobrança. |
