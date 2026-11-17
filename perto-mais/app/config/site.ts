// Fonte única da marca. Trocar o nome do produto = editar este arquivo.
export const site = {
  name: 'Perto+',
  shortName: 'Perto+',
  tagline: 'Seu bairro inteiro na palma da mão.',
  description:
    'Encontre lojas, restaurantes e serviços perto de você. Fale diretamente com quem faz acontecer no seu bairro.',
  locale: 'pt_BR',
  language: 'pt-BR',
  themeColor: '#E86B19',
  backgroundColor: '#F5F0E7',
  defaultOgImage: '/og-default.png',
  contactEmail: 'contato@exemplo.com.br',
  whatsappMessage: (platform: string) =>
    `Olá! Encontrei seu estabelecimento no ${platform} e gostaria de saber mais informações.`,
  whatsappProductMessage: (platform: string, product: string) =>
    `Olá! Vi o produto "${product}" no ${platform} e gostaria de saber mais informações.`,
} as const;

export type SiteConfig = typeof site;
