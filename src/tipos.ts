// Uma máscara é a identidade visual fixa de um perfil/site.
// Os arquivos (logo, overlay) ficam em public/mascaras/<id>/ ou em URLs.
export type Mascara = {
  id: string;
  nome: string;
  perfil: {
    nome: string; // assinatura em caixa alta, ex: "SEU SITE"
    handle: string; // sem @
  };
  logo?: string; // vai dentro do círculo; sem logo, o círculo mostra aspas
  overlayPng?: string; // PNG 1080x1920 com transparência, por cima de tudo (opcional)
  pretoEBranco?: boolean; // mídia em P&B, como no modelo
  cores: {
    destaque: string; // círculo, barras e palavras marcadas com *asteriscos*
    textoSobreDestaque: string; // aspas dentro do círculo
    etiquetaFundo: string; // caixa da etiqueta no topo
    etiquetaTexto: string;
  };
};

export type Midia = {
  tipo: 'video' | 'foto';
  src: string; // caminho dentro de public/ ou URL http(s)
};

export type Noticia = {
  midia: Midia;
  lead: string; // texto principal; trechos entre *asteriscos* ficam na cor de destaque
  editoria?: string; // vira "#Editoria" na etiqueta se não houver etiqueta
  etiqueta?: string; // ex: "Urgente", "#Política"
  credito?: string; // ex: "Foto: divulgação"
  pretoEBranco?: boolean; // sobrescreve a máscara
  duracaoFoto?: number; // segundos, só para foto
  duracaoMaxima?: number; // segundos, corta vídeos longos
};

export type ReelProps = {
  noticia: Noticia;
  mascara: Mascara;
};
