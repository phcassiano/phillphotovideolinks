// Uma máscara é a identidade visual fixa de um perfil/site.
// Os arquivos (avatar, logo, overlay) ficam em public/mascaras/<id>/ ou em URLs.
export type Mascara = {
  id: string;
  nome: string;
  perfil: {
    nome: string;
    handle: string; // sem @
    avatar?: string;
    verificado?: boolean;
  };
  logo?: string; // aparece no canto do card
  overlayPng?: string; // PNG 1080x1920 com transparência, por cima de tudo (opcional)
  cores: {
    destaque: string; // faixa da manchete e barra do lead
    textoDestaque: string;
    faixaPerfil: string; // faixa azul na base do card
    brilhoInferior: string; // brilho no rodapé do fundo
    brilhoSuperior: string; // brilho atrás do card
  };
};

export type Midia = {
  tipo: 'video' | 'foto';
  src: string; // caminho dentro de public/ ou URL http(s)
};

export type Noticia = {
  midia: Midia;
  pais?: string; // código do país, ex: "BR"
  editoria: string; // ex: "Política"
  manchete: string; // parte branca, ex: "PT vai à guerra"
  mancheteDestaque?: string; // parte na faixa, ex: "contra Flávio?"
  etiqueta?: string; // ex: "Polêmica"
  lead: string;
  credito?: string; // ex: "vídeo: @luizbacci"
  duracaoFoto?: number; // segundos, só para foto
  duracaoMaxima?: number; // segundos, corta vídeos longos
};

export type ReelProps = {
  noticia: Noticia;
  mascara: Mascara;
};
