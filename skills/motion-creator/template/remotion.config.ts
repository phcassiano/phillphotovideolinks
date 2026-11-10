import { Config } from "@remotion/cli/config";
import fs from "fs";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");

// Usa um Chrome já instalado na máquina se existir (evita download).
// Pode forçar com a variável REMOTION_BROWSER=/caminho/do/chrome
const pw = "/opt/pw-browsers";
const doPlaywright = fs.existsSync(pw)
  ? fs
      .readdirSync(pw)
      .filter((d) => d.startsWith("chromium_headless_shell"))
      .map((d) => `${pw}/${d}/chrome-headless-shell-linux64/chrome-headless-shell`)
  : [];
const candidatos = [process.env.REMOTION_BROWSER, ...doPlaywright].filter(
  Boolean,
) as string[];
const achado = candidatos.find((c) => fs.existsSync(c));
if (achado) Config.setBrowserExecutable(achado);
