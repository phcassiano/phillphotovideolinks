import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { MascotConfig } from "../types";
import { pop } from "../util";

/**
 * Mascote da marca, desenhado em SVG com volume (faces claras/escuras).
 * Formatos: cubo (padrão), gota, fantasma. Acessórios opcionais.
 * Pose: "idle" (respira), "pula", "acena", "anda".
 */
export const Mascot: React.FC<{
  config: MascotConfig;
  size?: number;
  pose?: "idle" | "pula" | "acena" | "anda";
  delay?: number;
  look?: "frente" | "cima" | "lado";
  style?: React.CSSProperties;
}> = ({ config, size = 180, pose = "idle", delay = 0, look = "frente", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = config.color ?? "#ff6a3d";
  const shape = config.shape ?? "cubo";
  const enter = pop(frame, fps, delay, 10);
  const f = frame - delay;

  const bob = pose === "pula" ? -Math.abs(Math.sin(f / 5)) * 40 : Math.sin(f / 9) * 6;
  const squash = pose === "pula" ? 1 + Math.max(0, Math.cos(f / 5)) * 0.06 : 1 + Math.sin(f / 9) * 0.02;
  const walkX = pose === "anda" ? Math.sin(f / 30) * 40 : 0;
  const blink = f % 90 > 84;
  const eyeY = look === "cima" ? -10 : 0;
  const eyeX = look === "lado" ? 8 : 0;
  const legSwing = pose === "anda" ? Math.sin(f / 3) * 8 : 0;

  const dark = shade(color, -0.28);
  const light = shade(color, 0.18);

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `translate(${walkX}px, ${bob}px) scale(${enter}) scaleY(${squash})`,
        transformOrigin: "50% 100%",
        filter: `drop-shadow(0 20px 30px rgba(0,0,0,.45)) drop-shadow(0 0 24px ${color}66)`,
        ...style,
      }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        {/* pernas */}
        <rect x={62 + legSwing} y={160} width={20} height={30} rx={6} fill={dark} />
        <rect x={118 - legSwing} y={160} width={20} height={30} rx={6} fill={dark} />

        {shape === "cubo" && (
          <>
            <polygon points="40,60 70,40 180,40 150,60" fill={light} />
            <polygon points="150,60 180,40 180,150 150,170" fill={dark} />
            <rect x={40} y={60} width={110} height={110} rx={10} fill={color} />
          </>
        )}
        {shape === "gota" && (
          <>
            <path d="M100 25 C 140 70 165 100 165 130 A 65 50 0 0 1 35 130 C 35 100 60 70 100 25 Z" fill={color} />
            <path d="M100 25 C 140 70 165 100 165 130 A 65 50 0 0 1 120 176 C 150 140 140 80 100 25 Z" fill={dark} />
          </>
        )}
        {shape === "fantasma" && (
          <>
            <path
              d="M40 175 L40 95 A 60 60 0 0 1 160 95 L160 175 L140 160 L120 175 L100 160 L80 175 L60 160 Z"
              fill={color}
            />
            <path d="M160 95 L160 175 L140 160 L130 168 C 150 140 150 100 130 50 A 60 60 0 0 1 160 95 Z" fill={dark} />
          </>
        )}

        {/* olhos */}
        {[75, 118].map((x, i) => (
          <g key={i} transform={`translate(${x + eyeX}, ${100 + eyeY})`}>
            {blink ? (
              <rect x={-11} y={-2} width={22} height={5} rx={2} fill="#1b1030" />
            ) : (
              <>
                <rect x={-11} y={-16} width={22} height={30} rx={8} fill="#1b1030" />
                <rect x={-5} y={-12} width={7} height={9} rx={3} fill="#fff" />
              </>
            )}
          </g>
        ))}
        {/* bochechas */}
        <ellipse cx={62} cy={128} rx={9} ry={5} fill="#ff9aa8" opacity={0.6} />
        <ellipse cx={132} cy={128} rx={9} ry={5} fill="#ff9aa8" opacity={0.6} />

        {/* braço acenando */}
        {pose === "acena" && (
          <rect
            x={150}
            y={90}
            width={16}
            height={50}
            rx={8}
            fill={dark}
            transform={`rotate(${-140 + Math.sin(f / 4) * 25} 158 110)`}
          />
        )}

        {config.accessory === "bone" && (
          <>
            <path d="M45 62 Q 100 15 150 62 Z" fill="#1b1030" />
            <rect x={110} y={56} width={70} height={10} rx={5} fill="#1b1030" />
          </>
        )}
        {config.accessory === "oculos" && (
          <g fill="none" stroke="#1b1030" strokeWidth={6}>
            <rect x={58} y={84} width={34} height={30} rx={8} fill="#1b103088" />
            <rect x={102} y={84} width={34} height={30} rx={8} fill="#1b103088" />
            <line x1={92} y1={96} x2={102} y2={96} />
          </g>
        )}
        {config.accessory === "coroa" && (
          <polygon points="60,58 70,25 88,48 100,18 112,48 130,25 140,58" fill="#ffc93d" stroke="#c99413" strokeWidth={3} />
        )}
        {config.accessory === "fone" && (
          <g>
            <path d="M42 100 Q 42 30 100 30 Q 158 30 158 100" stroke="#1b1030" strokeWidth={10} fill="none" />
            <rect x={30} y={88} width={22} height={40} rx={8} fill="#1b1030" />
            <rect x={148} y={88} width={22} height={40} rx={8} fill="#1b1030" />
          </g>
        )}
      </svg>
    </div>
  );
};

/** clareia (+) ou escurece (-) uma cor hex */
export const shade = (hex: string, amt: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt))),
  );
  return `rgb(${ch.join(",")})`;
};
