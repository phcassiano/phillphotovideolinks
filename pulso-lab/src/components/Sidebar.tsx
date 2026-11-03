import { Globe, Moon, Sun } from "lucide-react";
import logo from "../logo.svg";
import { sections, type PageId } from "../nav";

interface SidebarProps {
  current: PageId;
  onNavigate: (id: PageId) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function Sidebar({ current, onNavigate, theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={logo} alt="" width={36} height={36} />
        <div>
          <div className="brand-name">
            Pulso <span>Lab</span>
          </div>
          <div className="brand-sub">grátis • sem anúncios</div>
        </div>
      </div>

      <nav className="nav">
        {sections.map((section, i) => (
          <div key={i} className="nav-section">
            {section.title && <div className="nav-title">{section.title}</div>}
            {section.pages.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  className={`nav-item${current === p.id ? " active" : ""}`}
                  onClick={() => onNavigate(p.id)}
                  aria-current={current === p.id ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-row">
          <span className="lang">
            <Globe size={14} /> Português (Brasil)
          </span>
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        <div className="version">v{__APP_VERSION__} · Windows</div>
      </div>
    </aside>
  );
}
