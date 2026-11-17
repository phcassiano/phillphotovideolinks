import { data, Link } from 'react-router';
import type { Route } from './+types/categorias';
import { CategoryIcon } from '~/components/category-icon';
import { getCategoryTree } from '~/features/business/queries.server';
import { readLocation } from '~/lib/location.server';
import { seo } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const saved = readLocation(request);
  const tree = await getCategoryTree(supabase);
  return data({ tree, city: saved.city, hood: saved.neighborhood }, { headers });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ matches, title: 'Categorias', description: 'Todas as categorias de comércio e serviços do bairro.', path: '/categorias' });

export default function Categorias({ loaderData: { tree, city, hood } }: Route.ComponentProps) {
  const href = (slug: string) => (city && hood ? `/${city}/${hood}/${slug}` : `/explorar?categoria=${slug}`);
  return (
    <div className="container-page pt-6">
      <h1 className="text-2xl font-black tracking-tight md:text-3xl">Categorias</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <li key={c.id} className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
            <Link to={href(c.slug)} className="flex min-h-12 items-center gap-3 rounded-xl font-bold hover:text-brand-700">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <CategoryIcon name={c.icon} className="size-6" />
              </span>
              {c.name}
            </Link>
            {c.children.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {c.children.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={href(s.slug)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-cream px-3 text-sm font-semibold hover:bg-cream-200"
                    >
                      <CategoryIcon name={s.icon} className="size-4" /> {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
