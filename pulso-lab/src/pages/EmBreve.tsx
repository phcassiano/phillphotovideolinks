import { Check } from "lucide-react";
import type { PageInfo } from "../nav";

export function EmBreve({ page }: { page: PageInfo }) {
  const Icon = page.icon;
  return (
    <div className="page">
      <header className="page-header">
        <h1>{page.label}</h1>
        <p>{page.summary}</p>
      </header>
      <section className="card soon-card">
        <div className="soon-icon">
          <Icon size={30} strokeWidth={1.6} />
        </div>
        <div>
          <span className="badge">Chega na versão {page.version}</span>
          <h2>O que esta tela vai fazer</h2>
          <ul className="plan">
            {page.plan.map((item) => (
              <li key={item}>
                <Check size={15} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
