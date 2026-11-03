interface RingProps {
  /** 0 a 100 */
  value: number;
  size: number;
  stroke: number;
  color: string;
  spinning?: boolean;
  children?: React.ReactNode;
}

export function Ring({ value, size, stroke, color, spinning, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = spinning ? c * 0.28 : (c * Math.min(100, Math.max(0, value))) / 100;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className={spinning ? "ring-spin" : undefined} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-value"
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
