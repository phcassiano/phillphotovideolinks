import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';
import { site } from '~/config/site';
import { ToastProvider } from '~/components/ui/toast';
import { buttonVariants } from '~/components/ui/button';
import { publicEnv } from '~/lib/env.server';
import { readLocation } from '~/lib/location.server';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const links: Route.LinksFunction = () => [
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'icon', href: '/icons/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const saved = readLocation(request);

  const [userRes, citiesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('cities')
      .select('slug, name, latitude, longitude, neighborhoods(slug, name, latitude, longitude, is_active)')
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  const cities = citiesRes.data ?? [];
  const city = cities.find((c) => c.slug === saved.city) ?? cities[0] ?? null;
  const neighborhood =
    city && saved.city === city.slug ? (city.neighborhoods.find((n) => n.slug === saved.neighborhood && n.is_active) ?? null) : null;

  const authUser = userRes.data.user;
  let user: { id: string; email: string; isAdmin: boolean } | null = null;
  if (authUser) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', authUser.id);
    user = { id: authUser.id, email: authUser.email ?? '', isAdmin: !!roles?.some((r) => r.role === 'admin') };
  }

  return data(
    {
      env: publicEnv(),
      user,
      location: {
        city: city ? { slug: city.slug, name: city.name, latitude: city.latitude, longitude: city.longitude } : null,
        neighborhood: neighborhood ? { slug: neighborhood.slug, name: neighborhood.name } : null,
        geo: saved.geo,
        explicit: !!saved.city,
      },
    },
    { headers },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={site.themeColor} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  React.useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = 'Algo deu errado';
  let message = 'Tente novamente em instantes.';
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Página não encontrada';
      message = 'O endereço pode ter mudado ou o estabelecimento não está mais disponível.';
    } else {
      message = error.statusText || message;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }
  return (
    <main className="container-page grid min-h-dvh place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="text-5xl font-black text-brand">{site.name}</p>
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-ink-muted">{message}</p>
        <Link to="/" className={buttonVariants({ className: 'mt-8' })}>
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
