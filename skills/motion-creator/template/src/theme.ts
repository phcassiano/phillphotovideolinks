import { ThemeName } from "./types";

export interface Theme {
  name: ThemeName;
  /** fundo: céu de cima pra baixo */
  sky: [string, string, string];
  /** cor principal (neon / destaque) */
  primary: string;
  /** cor secundária */
  secondary: string;
  /** cor de acento (dourado, laranja...) */
  accent: string;
  text: string;
  /** texto sobre cartões claros */
  ink: string;
  card: string;
  /** gradiente do texto destacado */
  highlight: [string, string];
  fontDisplay: string;
  fontBody: string;
  /** cenário de fundo */
  backdrop: "city" | "paper" | "board" | "blocks" | "velvet" | "map";
  glow: number; // 0..1 intensidade de brilho
  grain: number; // 0..1 granulado
  scanlines: boolean;
}

const display = "'Rubik', 'Montserrat', 'Arial Black', system-ui, sans-serif";
const body = "'Inter', 'Helvetica Neue', Arial, sans-serif";

export const THEMES: Record<ThemeName, Theme> = {
  "neon-city": {
    name: "neon-city",
    sky: ["#1a0b2e", "#5b1a78", "#ff7a59"],
    primary: "#ff4fb8",
    secondary: "#8b5cf6",
    accent: "#ffb547",
    text: "#ffffff",
    ink: "#2a1840",
    card: "#fbf4ff",
    highlight: ["#ff5fa2", "#ffb547"],
    fontDisplay: display,
    fontBody: body,
    backdrop: "city",
    glow: 1,
    grain: 0.25,
    scanlines: false,
  },
  analogico: {
    name: "analogico",
    sky: ["#2b1d14", "#7a4b2a", "#e9b77c"],
    primary: "#ff8a3d",
    secondary: "#c8553d",
    accent: "#f2d0a4",
    text: "#fff4e3",
    ink: "#2b1d14",
    card: "#f6ead7",
    highlight: ["#ffcf8a", "#ff8a3d"],
    fontDisplay: "'Courier New', 'Rubik', monospace",
    fontBody: body,
    backdrop: "paper",
    glow: 0.35,
    grain: 0.7,
    scanlines: true,
  },
  quadro: {
    name: "quadro",
    sky: ["#14261d", "#1d3a2b", "#24473a"],
    primary: "#ffe066",
    secondary: "#7ee0c3",
    accent: "#ff8fa3",
    text: "#f4f1e8",
    ink: "#14261d",
    card: "#f4f1e8",
    highlight: ["#ffe066", "#ffd1dc"],
    fontDisplay: "'Comic Sans MS', 'Chalkboard SE', 'Rubik', cursive",
    fontBody: "'Comic Sans MS', 'Chalkboard SE', sans-serif",
    backdrop: "board",
    glow: 0.15,
    grain: 0.5,
    scanlines: false,
  },
  pop: {
    name: "pop",
    sky: ["#fff6e9", "#ffe3ec", "#e6f0ff"],
    primary: "#ff3d7f",
    secondary: "#3d7bff",
    accent: "#ffc93d",
    text: "#14142b",
    ink: "#14142b",
    card: "#ffffff",
    highlight: ["#ff3d7f", "#ff8a3d"],
    fontDisplay: display,
    fontBody: body,
    backdrop: "blocks",
    glow: 0,
    grain: 0.1,
    scanlines: false,
  },
  luxo: {
    name: "luxo",
    sky: ["#050505", "#15110a", "#2a2010"],
    primary: "#e8c46a",
    secondary: "#a8843a",
    accent: "#fff1c9",
    text: "#fdf6e3",
    ink: "#15110a",
    card: "#fdf6e3",
    highlight: ["#fff1c9", "#e8c46a"],
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: body,
    backdrop: "velvet",
    glow: 0.6,
    grain: 0.3,
    scanlines: false,
  },
  mapa: {
    name: "mapa",
    sky: ["#0d2235", "#123b56", "#1d5a7a"],
    primary: "#ff5a5f",
    secondary: "#3fd0c9",
    accent: "#ffd166",
    text: "#ffffff",
    ink: "#0d2235",
    card: "#f7fbff",
    highlight: ["#ffd166", "#ff5a5f"],
    fontDisplay: display,
    fontBody: body,
    backdrop: "map",
    glow: 0.5,
    grain: 0.15,
    scanlines: false,
  },
};

export const getTheme = (name?: ThemeName): Theme =>
  THEMES[name ?? "neon-city"] ?? THEMES["neon-city"];
