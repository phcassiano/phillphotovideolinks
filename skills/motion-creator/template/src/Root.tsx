import React from "react";
import { Composition } from "remotion";
import spec from "../video.json";
import { MotionVideo, totalFrames } from "./Video";
import { calcCompilado, calcCorte, Compilado, CompiladoProps, Corte, CorteProps } from "./Corte";
import { VideoSpec } from "./types";

const s = spec as unknown as VideoSpec;

const corteVazio: CorteProps = { src: "", duration: 3, srcW: 1920, srcH: 1080, words: [], titulo: "" };
const compiladoVazio: CompiladoProps = { titulo: "", itens: [] };

const Root: React.FC = () => (
  <>
    {/* vídeo de motion a partir do video.json */}
    <Composition
      id="MotionVideo"
      component={MotionVideo}
      durationInFrames={totalFrames(s)}
      fps={s.fps ?? 30}
      width={s.width ?? 1080}
      height={s.height ?? 1920}
      defaultProps={{ spec: s }}
    />
    {/* modo cortes: 1 corte vertical (props vêm de cortes/corte-XX.props.json) */}
    <Composition id="Corte" component={Corte} calculateMetadata={calcCorte} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={corteVazio} />
    {/* modo cortes: compilado horizontal de melhores momentos */}
    <Composition id="Compilado" component={Compilado} calculateMetadata={calcCompilado} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={compiladoVazio} />
  </>
);

export default Root;
