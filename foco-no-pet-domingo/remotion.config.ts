import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
// Opcional: usar um Chrome/Chromium já instalado (ex.: BROWSER_EXECUTABLE=/caminho/do/chrome)
if (process.env.BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.BROWSER_EXECUTABLE);
