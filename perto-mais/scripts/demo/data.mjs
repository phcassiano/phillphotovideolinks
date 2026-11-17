// Fonte única dos dados de demonstração. `npm run demo:build` gera
// supabase/seed.sql e as imagens em public/demo a partir daqui.
// Todos os nomes, telefones e endereços são fictícios.

export const ACCOUNTS = [
  { key: 'admin', id: '00000000-0000-4000-a000-000000000001', email: 'admin@perto.local', password: 'Perto+Admin123', fullName: 'Admin de Teste', admin: true },
  { key: 'gratuito', id: '00000000-0000-4000-a000-000000000002', email: 'gratuito@perto.local', password: 'Perto+Teste123', fullName: 'Comerciante Gratuito', phone: '+5561955550002' },
  { key: 'vitrine', id: '00000000-0000-4000-a000-000000000003', email: 'vitrine@perto.local', password: 'Perto+Teste123', fullName: 'Comerciante Vitrine', phone: '+5561955550003' },
  { key: 'demo', id: '00000000-0000-4000-a000-000000000004', email: 'demonstracao@perto.local', password: null, fullName: 'Dono Demonstração', demo: true },
];

const H = {
  comercial: [[1, '08:00', '18:00'], [2, '08:00', '18:00'], [3, '08:00', '18:00'], [4, '08:00', '18:00'], [5, '08:00', '18:00'], [6, '08:00', '13:00']],
  restaurante: [0, 2, 3, 4, 5, 6].flatMap((d) => [[d, '11:00', '15:00'], [d, '18:00', '23:00']]),
  pizzaria: [0, 2, 3, 4, 5, 6].map((d) => [d, '18:00', '00:30']),
  acai: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, '13:00', '22:30']),
  farmacia: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, '07:00', '23:00']),
  salao: [2, 3, 4, 5, 6].map((d) => [d, '09:00', '19:00']),
  academia: [[1, '05:30', '23:00'], [2, '05:30', '23:00'], [3, '05:30', '23:00'], [4, '05:30', '23:00'], [5, '05:30', '23:00'], [6, '08:00', '14:00']],
  lanchonete: [1, 2, 3, 4, 5, 6].map((d) => [d, '07:00', '20:00']),
  pastel: [[0, '07:00', '13:00'], [3, '07:00', '13:00'], [6, '07:00', '13:00']],
};

// cores do tema para as ilustrações
export const PALETTE = ['#E86B19', '#F4A261', '#2A9D8F', '#264653', '#E76F51', '#8E5572', '#457B9D', '#6A994E', '#BC6C25', '#5E548E'];

export const BUSINESSES = [
  {
    slug: 'pizzaria-forno-da-praca', name: 'Pizzaria Forno da Praça', owner: 'vitrine', category: 'pizzarias', hood: 'sobradinho',
    address: 'Quadra 8, Área Especial 12, Loja 3', lat: -15.6521, lng: -47.7899, whatsapp: '+5561955550101', phone: '+556135550101',
    instagram: 'fornodapraca.demo', plan: 'vitrine', featured: true, hours: H.pizzaria,
    keywords: ['pizza', 'delivery', 'forno a lenha', 'calzone'],
    description: 'Pizzas de fermentação natural assadas no forno a lenha, com massa fina e borda crocante. Atendemos no salão, retirada e entrega no bairro.',
    menu: {
      Pizzas: [
        ['Pizza Margherita', 'Molho de tomate, muçarela, manjericão fresco.', 4990, true],
        ['Pizza Calabresa', 'Calabresa fatiada, cebola roxa e azeitonas.', 4790],
        ['Pizza Quatro Queijos', 'Muçarela, provolone, parmesão e gorgonzola.', 5490],
      ],
      Bebidas: [['Suco natural 500 ml', 'Laranja, maracujá ou limão.', 1200], ['Refrigerante lata', null, 700]],
    },
    photos: 3,
  },
  {
    slug: 'acai-ponto-roxo', name: 'Açaí Ponto Roxo', owner: 'demo', category: 'acaiterias', hood: 'sobradinho',
    address: 'Quadra 10, Conjunto B, Loja 7', lat: -15.6560, lng: -47.7948, whatsapp: '+5561955550102', plan: 'vitrine', featured: true, hours: H.acai,
    keywords: ['açaí', 'acai', 'sorvete', 'cupuaçu'],
    description: 'Açaí batido na hora com mais de 20 complementos. Monte o seu copo do seu jeito.',
    menu: {
      'Copos de açaí': [
        ['Açaí 300 ml', 'Com dois complementos à escolha.', 1400, true],
        ['Açaí 500 ml', 'Com três complementos à escolha.', 2000],
        ['Açaí 700 ml', 'Com quatro complementos à escolha.', 2600],
      ],
      Extras: [['Cupuaçu 300 ml', 'Creme de cupuaçu batido na hora.', 1500], ['Leite em pó extra', null, 300, false, false]],
    },
    photos: 2,
  },
  {
    slug: 'restaurante-tempero-de-casa', name: 'Restaurante Tempero de Casa', owner: 'demo', category: 'restaurantes', hood: 'sobradinho',
    address: 'Quadra Central, Bloco 5, Loja 2', lat: -15.6546, lng: -47.7920, whatsapp: '+5561955550103', phone: '+556135550103', plan: 'vitrine', hours: H.restaurante,
    keywords: ['almoço', 'self-service', 'marmita', 'comida caseira'],
    description: 'Comida caseira feita todo dia: self-service no almoço e marmitas para levar. Feijoada aos sábados.',
    menu: {
      Pratos: [
        ['Prato executivo', 'Arroz, feijão, salada e uma proteína do dia.', 2490, true],
        ['Feijoada completa', 'Somente aos sábados. Serve 1 pessoa.', 3490],
        ['Marmita média', 'Monte com 4 acompanhamentos.', 2200],
      ],
      Sobremesas: [['Pudim de leite', 'Fatia.', 900]],
    },
    photos: 3,
  },
  {
    slug: 'farmacia-bem-viver', name: 'Farmácia Bem Viver', owner: 'gratuito', category: 'farmacias', hood: 'sobradinho',
    address: 'Quadra 8, Conjunto A, Loja 1', lat: -15.6510, lng: -47.7870, whatsapp: '+5561955550104', phone: '+556135550104', plan: 'gratuito', hours: H.farmacia,
    keywords: ['remédio', 'drogaria', 'medicamento', 'perfumaria'],
  },
  {
    slug: 'barbearia-navalha-fina', name: 'Barbearia Navalha Fina', owner: 'demo', category: 'barbearias', hood: 'sobradinho',
    address: 'Quadra 6, Bloco C, Loja 10', lat: -15.6575, lng: -47.7880, whatsapp: '+5561955550105', instagram: 'navalhafina.demo', plan: 'vitrine', hours: H.salao,
    keywords: ['corte', 'barba', 'cabelo masculino'],
    description: 'Cortes clássicos e modernos, barba com toalha quente e ambiente climatizado. Atendimento por ordem de chegada ou horário marcado pelo WhatsApp.',
    menu: {
      Serviços: [
        ['Corte masculino', 'Tesoura ou máquina.', 4000, true],
        ['Barba completa', 'Com toalha quente.', 3500],
        ['Corte + barba', null, 6500, true],
      ],
    },
    photos: 2,
  },
  {
    slug: 'mercadinho-bom-preco', name: 'Mercadinho Bom Preço', owner: 'demo', category: 'mercados', hood: 'sobradinho',
    address: 'Quadra 12, Conjunto D, Loja 4', lat: -15.6590, lng: -47.7965, whatsapp: '+5561955550106', phone: '+556135550106', plan: 'gratuito', hours: H.comercial,
    keywords: ['mercado', 'hortifruti', 'padaria', 'bebidas'],
  },
  {
    slug: 'pet-shop-patas-felizes', name: 'Pet Shop Patas Felizes', owner: 'demo', category: 'pet-shops', hood: 'sobradinho',
    address: 'Quadra 14, Bloco A, Loja 5', lat: -15.6502, lng: -47.7980, whatsapp: '+5561955550107', plan: 'vitrine', hours: H.comercial,
    keywords: ['banho', 'tosa', 'ração', 'veterinário'],
    description: 'Banho e tosa com hora marcada, rações e acessórios. Buscamos e levamos seu pet no bairro.',
    menu: {
      'Banho e tosa': [['Banho porte pequeno', null, 4500, true], ['Banho e tosa porte médio', null, 8000]],
      Produtos: [['Ração premium 3 kg', 'Adultos, sabor frango.', 8990], ['Petisco natural', 'Pacote 100 g.', 1590]],
    },
    photos: 2,
  },
  {
    slug: 'oficina-roda-viva', name: 'Oficina Roda Viva', owner: 'demo', category: 'servicos-automotivos', hood: 'sobradinho',
    address: 'Setor de Oficinas, Lote 22', lat: -15.6620, lng: -47.7850, whatsapp: '+5561955550108', plan: 'gratuito', status: 'pending', hours: H.comercial,
    keywords: ['mecânico', 'troca de óleo', 'alinhamento'],
  },
  {
    slug: 'lanchonete-sabor-da-esquina', name: 'Lanchonete Sabor da Esquina', owner: 'demo', category: 'lanchonetes', hood: 'sobradinho-ii',
    address: 'AR 13, Conjunto 4, Loja 1', lat: -15.6432, lng: -47.8210, whatsapp: '+5561955550109', plan: 'vitrine', featured: true, hours: H.lanchonete,
    keywords: ['lanche', 'hambúrguer', 'pastel', 'café da manhã'],
    description: 'Do café da manhã ao lanche da noite: pão na chapa, salgados assados e hambúrguer artesanal.',
    menu: {
      Lanches: [['X-Tudo artesanal', 'Pão brioche, blend 150 g, ovo, bacon e salada.', 2890, true], ['Misto quente', null, 900]],
      Salgados: [['Coxinha de frango', null, 650], ['Esfirra de carne', null, 600]],
      Bebidas: [['Café coado', null, 400], ['Vitamina de banana', '400 ml.', 1000]],
    },
    photos: 2,
  },
  {
    slug: 'salao-beleza-natural', name: 'Salão Beleza Natural', owner: 'demo', category: 'saloes-de-beleza', hood: 'sobradinho-ii',
    address: 'AR 9, Conjunto 2, Casa 15', lat: -15.6401, lng: -47.8250, whatsapp: '+5561955550110', instagram: 'belezanatural.demo', plan: 'vitrine', hours: H.salao,
    keywords: ['cabelo', 'manicure', 'escova', 'progressiva'],
    description: 'Cortes, coloração, tratamentos capilares e manicure. Produtos veganos e atendimento acolhedor.',
    menu: {
      Cabelo: [['Corte feminino', null, 7000, true], ['Escova', null, 5000], ['Hidratação', null, 6000]],
      Unhas: [['Manicure e pedicure', null, 5500]],
    },
    photos: 3,
  },
  {
    slug: 'atelie-fio-e-agulha', name: 'Ateliê Fio e Agulha', owner: 'demo', category: 'vestuario', hood: 'sobradinho-ii',
    address: 'AR 17, Conjunto 8, Loja 3', lat: -15.6455, lng: -47.8188, whatsapp: '+5561955550111', plan: 'vitrine', hours: H.comercial,
    keywords: ['roupa', 'costura', 'ajustes', 'moda feminina'],
    description: 'Moda feminina feita no bairro e ajustes de roupa em até 48 horas.',
    menu: {
      Peças: [['Vestido midi de linho', 'Tamanhos P ao GG.', 18900, true], ['Blusa de tricô', null, 9900]],
      Ajustes: [['Barra de calça', null, 2000], ['Ajuste de cintura', null, 3500]],
    },
    photos: 2,
  },
  {
    slug: 'academia-movimento-total', name: 'Academia Movimento Total', owner: 'demo', category: 'academias-e-esportes', hood: 'sobradinho-ii',
    address: 'AR 21, Lote 1', lat: -15.6380, lng: -47.8270, whatsapp: '+5561955550112', phone: '+556135550112', plan: 'gratuito', hours: H.academia,
    keywords: ['musculação', 'funcional', 'pilates'],
  },
  {
    slug: 'assistencia-celular-conecta', name: 'Assistência Celular Conecta', owner: 'demo', category: 'assistencia-tecnica', hood: 'sobradinho-ii',
    address: 'AR 13, Conjunto 1, Loja 9', lat: -15.6440, lng: -47.8230, whatsapp: '+5561955550113', plan: 'gratuito', status: 'pending', hours: H.comercial,
    keywords: ['celular', 'tela', 'bateria', 'conserto'],
  },
  {
    slug: 'restaurante-sabores-do-cerrado', name: 'Restaurante Sabores do Cerrado', owner: 'demo', category: 'restaurantes', hood: 'grande-colorado',
    address: 'Rua 3, Lote 40', lat: -15.6801, lng: -47.8420, whatsapp: '+5561955550114', phone: '+556135550114', instagram: 'saboresdocerrado.demo', plan: 'vitrine', hours: H.restaurante,
    keywords: ['pequi', 'galinhada', 'comida goiana', 'almoço'],
    description: 'Cozinha do Cerrado com ingredientes da região: galinhada com pequi, arroz com guariroba e doces de baru.',
    menu: {
      Pratos: [['Galinhada com pequi', 'Serve 2 pessoas.', 6900, true], ['Arroz com guariroba', 'Acompanha frango caipira.', 5400]],
      Sobremesas: [['Doce de baru', null, 1200], ['Pamonha doce', null, 900, false, false]],
    },
    photos: 3,
  },
  {
    slug: 'calcados-passo-certo', name: 'Calçados Passo Certo', owner: 'demo', category: 'calcados', hood: 'grande-colorado',
    address: 'Avenida Principal, Loja 15', lat: -15.6780, lng: -47.8395, whatsapp: '+5561955550115', plan: 'gratuito', hours: H.comercial,
    keywords: ['tênis', 'sapato', 'sandália', 'chinelo'],
  },
  {
    slug: 'reforma-facil-materiais', name: 'Reforma Fácil Materiais', owner: 'demo', category: 'construcao-e-reformas', hood: 'grande-colorado',
    address: 'Rua 8, Galpão 2', lat: -15.6822, lng: -47.8440, phone: '+556135550116', whatsapp: '+5561955550116', plan: 'gratuito', hours: null,
    keywords: ['material de construção', 'tinta', 'cimento', 'pedreiro'],
  },
  {
    slug: 'contabilidade-prumo', name: 'Contabilidade Prumo', owner: 'demo', category: 'servicos-profissionais', hood: 'grande-colorado',
    address: 'Rua 5, Sala 204', lat: -15.6770, lng: -47.8430, whatsapp: '+5561955550117', plan: 'gratuito', status: 'pending', hours: H.comercial,
    keywords: ['contador', 'MEI', 'imposto de renda'],
  },
  {
    slug: 'pizzaria-massa-fina', name: 'Pizzaria Massa Fina', owner: 'demo', category: 'pizzarias', hood: 'planaltina',
    address: 'Setor Tradicional, Quadra 4, Loja 8', lat: -15.6200, lng: -47.6510, whatsapp: '+5561955550118', plan: 'vitrine', hours: H.pizzaria,
    keywords: ['pizza', 'esfiha', 'delivery'],
    description: 'Pizzas de massa fina, esfihas abertas e rodízio às sextas-feiras.',
    menu: {
      Pizzas: [['Pizza Portuguesa', null, 4590, true], ['Pizza Frango com Catupiry', null, 4790]],
      Esfihas: [['Esfiha de carne', null, 550], ['Esfiha de queijo', null, 550]],
    },
    photos: 2,
  },
  {
    slug: 'drogaria-saude-popular', name: 'Drogaria Saúde Popular', owner: 'demo', category: 'farmacias', hood: 'planaltina',
    address: 'Setor Central, Quadra 2, Loja 1', lat: -15.6230, lng: -47.6545, whatsapp: '+5561955550119', phone: '+556135550119', plan: 'gratuito', hours: H.farmacia,
    keywords: ['remédio', 'farmácia popular', 'genéricos'],
  },
  {
    slug: 'pastelaria-feira-livre', name: 'Pastelaria Feira Livre', owner: 'demo', category: 'lanchonetes', hood: 'planaltina',
    address: 'Feira Permanente, Box 31', lat: -15.6195, lng: -47.6560, whatsapp: '+5561955550120', plan: 'gratuito', hours: H.pastel,
    keywords: ['pastel', 'caldo de cana', 'feira'],
  },
];
