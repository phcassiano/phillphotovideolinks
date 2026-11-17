import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
  ssr: true,
  // No Vercel (variável VERCEL definida no build), gera funções serverless; localmente, servidor Node.
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config;
