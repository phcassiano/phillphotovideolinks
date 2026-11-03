import {
  AppWindow,
  BatteryMedium,
  BellRing,
  CalendarClock,
  ChartPie,
  CircuitBoard,
  Gamepad2,
  History,
  Copy,
  Gauge,
  HardDrive,
  House,
  Keyboard,
  Monitor,
  Package,
  PackageX,
  Rocket,
  Trash2,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  | "painel"
  | "pos-formatacao"
  | "programas"
  | "meu-pc"
  | "discos"
  | "bateria"
  | "windows"
  | "drivers"
  | "rede"
  | "benchmark"
  | "perifericos"
  | "limpeza"
  | "mapa-disco"
  | "duplicados"
  | "otimizacoes"
  | "desinstalador"
  | "historico"
  | "manutencao"
  | "alertas"
  | "modo-jogo";

export interface PageInfo {
  id: PageId;
  label: string;
  icon: LucideIcon;
  /** Versão em que a tela fica pronta (as telas ainda não feitas mostram este plano). */
  version: string;
  summary: string;
  plan: string[];
}

export interface NavSection {
  title?: string;
  pages: PageInfo[];
}

export const sections: NavSection[] = [
  {
    pages: [
      {
        id: "painel",
        label: "Painel",
        icon: House,
        version: "0.1",
        summary: "A nota de saúde do PC e um resumo do que precisa de atenção.",
        plan: [],
      },
      {
        id: "pos-formatacao",
        label: "Pós-formatação",
        icon: Rocket,
        version: "0.4",
        summary: "Deixa o PC pronto depois de formatar, seguindo etapas na ordem. Dá para parar, reiniciar e continuar depois.",
        plan: [
          "Cria um ponto de restauração antes de tudo",
          "Confere o Windows Update e a ativação do Windows",
          "Remove os apps que vêm de fábrica e você não usa",
          "Instala seus programas em português, sem clicar em nada",
          "Aplica ajustes rápidos, como acertar o relógio e mostrar \"Este Computador\" na Área de Trabalho",
          "Antes de formatar: salva uma cópia dos drivers. Depois: devolve todos de uma vez",
        ],
      },
      {
        id: "programas",
        label: "Programas",
        icon: Package,
        version: "0.4",
        summary: "Um catálogo de programas confiáveis para instalar ou atualizar com um clique.",
        plan: [
          "Catálogo por categoria: navegadores, compactadores, comunicação, utilitários",
          "Instala em português e em silêncio",
          "Mostra os programas que têm versão nova e atualiza todos de uma vez",
          "Você escolhe quais programas nunca atualizar",
          "Confere sozinho, toda semana, se há versões novas e avisa",
        ],
      },
      {
        id: "historico",
        label: "Histórico",
        icon: History,
        version: "0.2",
        summary: "Tudo o que o Pulso Lab mudou no seu PC, com o botão Desfazer em cada item.",
        plan: [
          "Cada ajuste guarda como estava antes de mudar",
          "Desfazer um item só ou tudo de um dia",
          "Mostra os pontos de restauração criados pelo Pulso Lab",
        ],
      },
    ],
  },
  {
    title: "Meu PC",
    pages: [
      {
        id: "meu-pc",
        label: "Meu PC",
        icon: Monitor,
        version: "0.6",
        summary: "Tudo sobre o seu computador: processador, memória, placa-mãe, placa de vídeo e discos.",
        plan: [
          "Ficha completa do hardware",
          "Temperaturas e uso em tempo real",
          "Botão \"Copiar relatório do PC\": hardware, Windows, nota e problemas em texto, para mandar ao técnico por WhatsApp ou e-mail",
        ],
      },
      {
        id: "alertas",
        label: "Alertas",
        icon: BellRing,
        version: "0.5",
        summary: "Um ícone perto do relógio que avisa quando algo precisa de atenção, sem você abrir o app.",
        plan: [
          "Disco do Windows quase cheio",
          "Disco com sinais de defeito",
          "Programa usando memória demais",
          "PC ligado há muitos dias sem reiniciar",
          "Você liga ou desliga cada aviso",
        ],
      },
      {
        id: "discos",
        label: "Saúde dos discos",
        icon: HardDrive,
        version: "0.5",
        summary: "Mostra se cada HD, SSD, pendrive e cartão está saudável, e descobre pendrive falsificado.",
        plan: [
          "Temperatura, desgaste e avisos de falha (só lê, nada é gravado)",
          "Teste de capacidade falsa para pendrive, cartão e HD externo",
          "Seus arquivos são guardados antes do teste e devolvidos no final",
        ],
      },
      {
        id: "bateria",
        label: "Bateria",
        icon: BatteryMedium,
        version: "0.6",
        summary: "Quanto a bateria do notebook ainda aguenta em comparação com quando era nova.",
        plan: ["Capacidade atual x capacidade original", "Número de ciclos de carga", "Histórico de uso"],
      },
      {
        id: "windows",
        label: "Windows 11",
        icon: AppWindow,
        version: "0.6",
        summary: "Ajustes do Windows explicados em português, sempre com opção de desfazer.",
        plan: ["Ajustes de privacidade e desempenho", "Menu Iniciar e barra de tarefas", "Cada ajuste com o botão Desfazer"],
      },
      {
        id: "drivers",
        label: "Drivers",
        icon: CircuitBoard,
        version: "0.4",
        summary: "Encontra os aparelhos com problema, guarda uma cópia dos drivers e atualiza pelo caminho seguro.",
        plan: [
          "Lista os aparelhos com erro ou sem driver",
          "Cópia de segurança de todos os drivers e restauração com um clique",
          "Atualiza drivers só pelo Windows Update ou pelo site do fabricante, nunca de sites de terceiros (v0.6)",
        ],
      },
      {
        id: "rede",
        label: "Rede",
        icon: Wifi,
        version: "0.6",
        summary: "Testa a internet e resolve problemas comuns de conexão.",
        plan: ["Teste de velocidade e de ping", "Limpar o cache de DNS e reiniciar a rede", "Senhas de Wi-Fi salvas"],
      },
    ],
  },
  {
    title: "Testes",
    pages: [
      {
        id: "benchmark",
        label: "Benchmark",
        icon: Gauge,
        version: "0.6",
        summary: "Mede a velocidade do processador, da memória e dos discos.",
        plan: ["Teste de CPU em todos os núcleos", "Leitura e gravação dos discos", "Compara com o resultado anterior"],
      },
      {
        id: "perifericos",
        label: "Periféricos",
        icon: Keyboard,
        version: "0.6",
        summary: "Testa teclado, mouse, microfone, alto-falantes e webcam.",
        plan: ["Teste de teclas", "Teste de microfone e som", "Teste de webcam"],
      },
    ],
  },
  {
    title: "Otimizar",
    pages: [
      {
        id: "limpeza",
        label: "Limpeza",
        icon: Trash2,
        version: "0.2",
        summary: "Libera espaço apagando arquivos que o PC não precisa mais. Documentos, fotos e programas não são tocados.",
        plan: [
          "Arquivos temporários, cache do Windows Update, miniaturas e relatórios de erro",
          "Cache dos navegadores (Chrome, Edge, Firefox)",
          "Cada item com selo Seguro, Moderado ou Avançado; os recomendados já vêm marcados",
          "A Lixeira só é esvaziada se você marcar",
          "Suas próprias pastas para limpar e pastas protegidas, que nunca são tocadas",
        ],
      },
      {
        id: "mapa-disco",
        label: "Mapa do disco",
        icon: ChartPie,
        version: "0.6",
        summary: "Mostra em um mapa o que está ocupando o espaço do disco.",
        plan: [
          "Pastas e arquivos maiores",
          "Abrir a pasta direto no Explorador",
          "Apagar com segurança: o arquivo é sobrescrito antes de sair (em SSD, o Windows já cuida disso)",
          "Atalhos no botão direito do Explorador: \"Apagar com segurança\" e \"Ver o que ocupa espaço aqui\"",
        ],
      },
      {
        id: "duplicados",
        label: "Arquivos duplicados",
        icon: Copy,
        version: "0.6",
        summary: "Encontra cópias repetidas de fotos, vídeos e documentos.",
        plan: ["Compara pelo conteúdo, não só pelo nome", "Você escolhe qual cópia manter"],
      },
      {
        id: "otimizacoes",
        label: "Otimizações",
        icon: Zap,
        version: "0.2",
        summary: "Programas que abrem com o Windows e ajustes recomendados para o PC ficar mais leve.",
        plan: [
          "Desativar programas que abrem junto com o Windows (sem desinstalar)",
          "Ajustes recomendados de desempenho",
          "Modo de eficiência: deixa apps em segundo plano mais leves sem fechar nada, como o Gerenciador de Tarefas do Windows 11 faz (v0.6)",
          "Tudo dá para desfazer",
        ],
      },
      {
        id: "desinstalador",
        label: "Desinstalador",
        icon: PackageX,
        version: "0.3",
        summary: "Remove vários programas de uma vez, em silêncio, e procura as sobras.",
        plan: [
          "Programas instalados e apps da Microsoft Store",
          "Remove os apps que vêm de fábrica (bloatware)",
          "Procura sobras em três níveis: Seguro, Moderado e Avançado",
          "Cria um ponto de restauração antes",
          "Desinstalação forçada para programa quebrado que não sai: mostra tudo o que sobrou e você escolhe o que apagar",
          "Instalar com o Pulso Lab: anota tudo o que o instalador mudou, para remover 100% depois (v0.6)",
        ],
      },
      {
        id: "manutencao",
        label: "Manutenção automática",
        icon: CalendarClock,
        version: "0.3",
        summary: "O Pulso Lab cuida do PC sozinho, no dia e na hora que você escolher, sem precisar abrir o app.",
        plan: [
          "Limpeza semanal só com os itens Seguros",
          "Aviso no fim: quanto espaço foi liberado",
          "Opção de limpar o histórico e o cache dos navegadores ao desligar o PC",
          "Pausa sozinha se o notebook estiver na bateria",
        ],
      },
      {
        id: "modo-jogo",
        label: "Modo Jogo",
        icon: Gamepad2,
        version: "0.6",
        summary: "Quando você abre um jogo, o PC foca nele. Quando fecha, tudo volta ao normal.",
        plan: [
          "Encontra os jogos do Steam, Epic e Xbox",
          "Plano de energia de alto desempenho durante o jogo",
          "Deixa os apps em segundo plano mais leves e pausa as notificações",
          "Sem promessa de milagre: o ganho costuma ser pequeno (de 1 a 10 FPS) e o app mostra a diferença medida",
        ],
      },
    ],
  },
];

export const pages: Record<PageId, PageInfo> = Object.fromEntries(
  sections.flatMap((s) => s.pages).map((p) => [p.id, p]),
) as Record<PageId, PageInfo>;
