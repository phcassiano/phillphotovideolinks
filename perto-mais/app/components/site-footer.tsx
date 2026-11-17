import { Link } from 'react-router';
import { Logo } from '~/components/brand';
import { site } from '~/config/site';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-cream-200/60 pb-24 pt-10 md:pb-10">
      <div className="container-page grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-muted">{site.description}</p>
        </div>
        <nav aria-label="Para você">
          <h2 className="text-sm font-bold">Para você</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/explorar">Explorar o bairro</Link></li>
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/categorias">Categorias</Link></li>
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/mapa">Mapa</Link></li>
          </ul>
        </nav>
        <nav aria-label="Para comerciantes">
          <h2 className="text-sm font-bold">Para comerciantes</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/anuncie">Anuncie seu negócio</Link></li>
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/planos">Planos</Link></li>
            <li><Link className="inline-block py-1.5 hover:text-brand-700" to="/login">Entrar</Link></li>
          </ul>
        </nav>
      </div>
      <div className="container-page mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm text-ink-muted">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <Link className="hover:text-brand-700" to="/termos">Termos de uso</Link>
        <Link className="hover:text-brand-700" to="/privacidade">Privacidade</Link>
      </div>
    </footer>
  );
}
