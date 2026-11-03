import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta fixa: o Tauri abre esta mesma URL no modo de desenvolvimento.
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0") },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022", outDir: "dist" },
});
