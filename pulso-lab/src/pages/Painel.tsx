import {
  Check as CheckIcon,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleX,
  Clock,
  Cpu,
  HardDrive,
  Info,
  MemoryStick,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMemory, getOverview, isDesktop } from "../api";
import { Ring } from "../components/Ring";
import { formatBytes, formatTime, formatUptime, pct } from "../format";
import { buildChecks, score, scoreColor, type Check, type CheckStatus } from "../health";
import { pages, sections, type PageId } from "../nav";
import { load, save } from "../storage";
import type { Memory, Overview } from "../types";

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  ok: <CheckIcon size={16} />,
  warn: <TriangleAlert size={16} />,
  bad: <CircleX size={16} />,
  soon: <CircleDashed size={16} />,
};

const MIN_ANALYSIS_MS = 900;

export function Painel({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [ignored, setIgnored] = useState<string[]>(() => load<string[]>("pulso.ignored", []));
  const [showSoon, setShowSoon] = useState(false);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    const started = Date.now();
    try {
      const o = await getOverview();
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_ANALYSIS_MS - (Date.now() - started))));
      setOverview(o);
      setMemory(o.memory);
      setLastRun(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    analyze();
  }, [analyze]);

  // A memória muda o tempo todo: atualiza o card a cada 3 segundos.
  useEffect(() => {
    const t = setInterval(() => {
      getMemory().then(setMemory).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const checks = useMemo(() => (overview ? buildChecks(overview) : []), [overview]);
  const value = score(checks, ignored);
  const pending = checks.filter((c) => (c.status === "warn" || c.status === "bad") && !ignored.includes(c.id));
  const liveChecks = checks.filter((c) => c.status !== "soon");
  const soonChecks = checks.filter((c) => c.status === "soon");

  const toggleIgnore = (id: string) => {
    const next = ignored.includes(id) ? ignored.filter((x) => x !== id) : [...ignored, id];
    setIgnored(next);
    save("pulso.ignored", next);
  };

  const title = analyzing
    ? "Analisando seu PC…"
    : pending.length > 0
      ? "Seu PC precisa de atenção"
      : "Seu PC está em ótima forma";
  const subtitle = analyzing
    ? "Leva só um instante. Nada é alterado durante a análise."
    : pending.length > 0
      ? `${pending.length} item(ns) para resolver. Clique em "Resolver" para ir à tela certa.`
      : "Nada para resolver agora. Volte depois de instalar programas novos ou de uma atualização grande do Windows.";

  return (
    <div className="page">
      {!isDesktop && (
        <div className="demo-banner">
          <Info size={15} /> Modo de demonstração no navegador: os números são de exemplo. No app, aparecem os dados
          reais do PC.
        </div>
      )}

      <section className="card hero">
        <Ring
          value={analyzing ? 0 : value}
          size={176}
          stroke={12}
          color={analyzing ? "var(--accent)" : scoreColor(value)}
          spinning={analyzing}
        >
          {analyzing ? (
            <>
              <Search size={26} />
              <span className="ring-label">analisando</span>
            </>
          ) : (
            <>
              <span className="ring-number" style={{ color: scoreColor(value) }}>
                {value}
              </span>
              <span className="ring-label">saúde do PC</span>
            </>
          )}
        </Ring>

        <div className="hero-body">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          <p className="meta">
            <Clock size={13} />
            {lastRun ? `Última análise: hoje às ${formatTime(lastRun)} · nota ${value}` : "Primeira análise"}
            <span className="dot">·</span>
            <span title="As outras verificações chegam nas próximas versões">
              nota parcial: {liveChecks.length} de {checks.length || 9} verificações
            </span>
          </p>

          {error && <p className="error">Não foi possível ler os dados do PC: {error}</p>}

          <ul className="checks">
            {(showSoon ? checks : liveChecks).map((c) => (
              <CheckRow
                key={c.id}
                check={c}
                ignored={ignored.includes(c.id)}
                onResolve={c.fixPage ? () => onNavigate(c.fixPage!) : undefined}
                onToggleIgnore={() => toggleIgnore(c.id)}
              />
            ))}
          </ul>
          {soonChecks.length > 0 && (
            <button className="soon-toggle" onClick={() => setShowSoon(!showSoon)} aria-expanded={showSoon}>
              <ChevronDown size={15} className={showSoon ? "flip" : undefined} />
              {showSoon
                ? "Esconder as verificações das próximas versões"
                : `Mais ${soonChecks.length} verificações chegam nas próximas versões`}
            </button>
          )}

          <div className="actions">
            <button className="btn primary" onClick={analyze} disabled={analyzing}>
              <RefreshCw size={15} className={analyzing ? "spin" : undefined} />
              {analyzing ? "Analisando…" : "Analisar de novo"}
            </button>
          </div>
        </div>
      </section>

      <section className="stats">
        <StatCard
          icon={<MemoryStick size={18} />}
          ring={memory ? pct(memory.usedBytes, memory.totalBytes) : null}
          label="Memória RAM"
          value={memory ? `${formatBytes(memory.usedBytes)} de ${formatBytes(memory.totalBytes)}` : "…"}
        />
        <StatCard
          icon={<HardDrive size={18} />}
          ring={
            overview?.systemDisk
              ? pct(overview.systemDisk.totalBytes - overview.systemDisk.freeBytes, overview.systemDisk.totalBytes)
              : null
          }
          label={`Disco do Windows${overview?.systemDisk ? ` (${overview.systemDisk.mountPoint})` : ""}`}
          value={
            overview?.systemDisk
              ? `${formatBytes(overview.systemDisk.freeBytes)} livres de ${formatBytes(overview.systemDisk.totalBytes)}`
              : "…"
          }
        />
        <div className="card stat system">
          <div className="stat-icon">
            <Cpu size={20} />
          </div>
          <div className="stat-text">
            <span className="stat-label">{overview?.osName ?? "…"}</span>
            <strong title={overview?.cpuName}>{overview?.cpuName ?? "…"}</strong>
            <span className="stat-label">
              {overview
                ? `${overview.cpuCores} núcleos / ${overview.cpuThreads} threads · ligado há ${formatUptime(overview.uptimeSeconds)}`
                : ""}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Ferramentas</h2>
        <div className="tools">
          {sections
            .flatMap((s) => s.pages)
            .filter((p) => p.id !== "painel")
            .map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.id} className="card tool" onClick={() => onNavigate(p.id)}>
                  <Icon size={20} strokeWidth={1.7} />
                  <span className="tool-name">{p.label}</span>
                  <span className="tool-version">v{pages[p.id].version}</span>
                  <ChevronRight size={15} className="tool-arrow" />
                </button>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function CheckRow({
  check,
  ignored,
  onResolve,
  onToggleIgnore,
}: {
  check: Check;
  ignored: boolean;
  onResolve?: () => void;
  onToggleIgnore: () => void;
}) {
  const needsAction = check.status === "warn" || check.status === "bad";
  return (
    <li className={`check ${check.status}${ignored ? " ignored" : ""}`}>
      <span className="check-icon">{STATUS_ICON[check.status]}</span>
      <div className="check-text">
        <strong>{check.title}</strong>
        <span>{ignored ? "Ignorado: não conta na nota" : check.detail}</span>
      </div>
      {needsAction && (
        <div className="check-actions">
          {!ignored && onResolve && (
            <button className="link-btn" onClick={onResolve}>
              Resolver
            </button>
          )}
          <button className="link-btn subtle" onClick={onToggleIgnore}>
            {ignored ? "Voltar a contar" : "Ignorar"}
          </button>
        </div>
      )}
    </li>
  );
}

function StatCard({
  icon,
  ring,
  label,
  value,
}: {
  icon: React.ReactNode;
  ring: number | null;
  label: string;
  value: string;
}) {
  const r = ring ?? 0;
  const color = r >= 90 ? "var(--bad)" : r >= 80 ? "var(--warn)" : "var(--accent)";
  return (
    <div className="card stat">
      <Ring value={r} size={54} stroke={5} color={ring === null ? "transparent" : color}>
        <span className="ring-small">{ring === null ? "–" : `${ring}%`}</span>
      </Ring>
      <div className="stat-text">
        <span className="stat-label">
          {icon} {label}
        </span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
