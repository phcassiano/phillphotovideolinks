import type { MetaDescriptor } from 'react-router';
import { site } from '~/config/site';

type Match = { id: string; data?: unknown } | undefined;

export function siteUrlFromMatches(matches: Match[]): string {
  const root = matches.find((m) => m?.id === 'root')?.data as { env?: { SITE_URL?: string } } | undefined;
  return root?.env?.SITE_URL ?? '';
}

export function absoluteUrl(siteUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function seo({
  matches,
  title,
  description = site.description,
  path,
  image,
  noindex = false,
  type = 'website',
  jsonLd = [],
}: {
  matches: Match[];
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
  type?: 'website' | 'business.business' | 'article';
  jsonLd?: object[];
}): MetaDescriptor[] {
  const siteUrl = siteUrlFromMatches(matches);
  const fullTitle = title === site.name ? `${site.name} · ${site.tagline}` : `${title} · ${site.name}`;
  const url = absoluteUrl(siteUrl, path);
  const img = absoluteUrl(siteUrl, image || site.defaultOgImage);
  const desc = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
  return [
    { title: fullTitle },
    { name: 'description', content: desc },
    { tagName: 'link', rel: 'canonical', href: url },
    ...(noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
    { property: 'og:site_name', content: site.name },
    { property: 'og:locale', content: site.locale },
    { property: 'og:type', content: type },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: desc },
    { property: 'og:url', content: url },
    { property: 'og:image', content: img },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: desc },
    { name: 'twitter:image', content: img },
    ...jsonLd.map((obj) => ({ 'script:ld+json': obj })),
  ];
}

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(siteUrl, it.path),
    })),
  };
}

export const noIndexMeta: MetaDescriptor[] = [{ name: 'robots', content: 'noindex, nofollow' }];
