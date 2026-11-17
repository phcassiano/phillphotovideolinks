import { describe, expect, it } from 'vitest';
import { formatPhoneBR, isMobileE164, toE164BR } from '~/lib/phone';
import { slugify } from '~/lib/slug';
import { productWhatsappLink, whatsappLink } from '~/lib/whatsapp';
import { formatBRL, parseBRL } from '~/lib/money';
import { groupHours, isOpenAt, nowInZone } from '~/lib/hours';
import { distanceKm, formatDistance, nearest } from '~/lib/geo';
import { mediaUrl } from '~/lib/images';
import { parseListingParams } from '~/features/business/listing-params';
import { site } from '~/config/site';

describe('telefone', () => {
  it.each([
    ['(61) 99999-0000', '+5561999990000'],
    ['61 3333-4444', '+556133334444'],
    ['+55 61 99999-0000', '+5561999990000'],
    ['0 61 99999 0000', '+5561999990000'],
    ['5561999990000', '+5561999990000'],
  ])('%s → %s', (input, out) => expect(toE164BR(input)).toBe(out));

  it.each(['', '123', '(61) 89999-0000', '(10) 99999-0000', '(61) 0333-4444'])('rejeita %s', (input) =>
    expect(toE164BR(input)).toBeNull(),
  );

  it('formata e detecta celular', () => {
    expect(formatPhoneBR('+5561955550101')).toBe('(61) 95555-0101');
    expect(formatPhoneBR('+556135550101')).toBe('(61) 3555-0101');
    expect(isMobileE164('+5561955550101')).toBe(true);
    expect(isMobileE164('+556135550101')).toBe(false);
  });
});

describe('slug', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Açaí Ponto Roxo!')).toBe('acai-ponto-roxo');
    expect(slugify('  São Sebastião / DF ')).toBe('sao-sebastiao-df');
    expect(slugify('Pão & Café')).toBe('pao-cafe');
  });
});

describe('whatsapp', () => {
  it('monta wa.me com a mensagem padrão citando a plataforma', () => {
    const url = whatsappLink('+5561955550101');
    expect(url.startsWith('https://wa.me/5561955550101?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe(
      `Olá! Encontrei seu estabelecimento no ${site.name} e gostaria de saber mais informações.`,
    );
  });
  it('mensagem de produto cita o produto', () => {
    expect(decodeURIComponent(productWhatsappLink('+5561955550101', 'Pizza & Cia').split('text=')[1]!)).toContain('"Pizza & Cia"');
  });
});

describe('dinheiro', () => {
  it('formata e interpreta', () => {
    expect(formatBRL(1990)).toMatch(/R\$\s19,90/);
    expect(parseBRL('19,90')).toBe(1990);
    expect(parseBRL('R$ 1.234,50')).toBe(123450);
    expect(parseBRL('12.5')).toBe(1250);
    expect(parseBRL('abc')).toBeNull();
  });
});

describe('horários', () => {
  const rows = [
    { weekday: 2, opens_at: '18:00:00', closes_at: '00:30:00' },
    { weekday: 3, opens_at: '11:00:00', closes_at: '15:00:00' },
    { weekday: 3, opens_at: '18:00:00', closes_at: '23:00:00' },
  ];
  it('trata virada da meia-noite e vários intervalos', () => {
    expect(isOpenAt(rows, 2, '19:00')).toBe(true);
    expect(isOpenAt(rows, 3, '00:15')).toBe(true); // ainda é o turno de terça
    expect(isOpenAt(rows, 3, '00:45')).toBe(false);
    expect(isOpenAt(rows, 3, '12:00')).toBe(true);
    expect(isOpenAt(rows, 3, '16:00')).toBe(false);
    expect(isOpenAt([], 3, '12:00')).toBeNull();
  });
  it('agrupa de segunda a domingo', () => {
    const g = groupHours(rows);
    expect(g[0]!.label).toBe('Segunda');
    expect(g.find((d) => d.weekday === 3)!.intervals).toEqual(['11:00–15:00', '18:00–23:00']);
  });
  it('calcula dia e hora em America/Sao_Paulo', () => {
    // 2026-11-17T02:30Z = segunda 23:30 em São Paulo (UTC-3)
    expect(nowInZone('America/Sao_Paulo', new Date('2026-11-17T02:30:00Z'))).toEqual({ weekday: 1, time: '23:30' });
  });
});

describe('geo', () => {
  it('distância e formatação', () => {
    const d = distanceKm(-15.6533, -47.7915, -15.6214, -47.6528);
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(16);
    expect(formatDistance(0.42)).toBe('400 m');
    expect(formatDistance(3.456)).toBe('3,5 km');
  });
  it('bairro mais próximo', () => {
    const items = [
      { slug: 'a', latitude: -15.65, longitude: -47.79 },
      { slug: 'b', latitude: -15.62, longitude: -47.65 },
      { slug: 'c', latitude: null, longitude: null },
    ];
    expect(nearest(items, -15.621, -47.66)?.slug).toBe('b');
  });
});

describe('imagens', () => {
  it('resolve caminhos estáticos e do storage', () => {
    expect(mediaUrl('http://x', '/demo/a.webp')).toBe('/demo/a.webp');
    expect(mediaUrl('http://x/', 'abc/logo.webp')).toBe('http://x/storage/v1/object/public/business-media/abc/logo.webp');
    expect(mediaUrl('http://x', null)).toBeNull();
  });
});

describe('filtros da listagem', () => {
  it('interpreta a querystring', () => {
    const f = parseListingParams(new URL('http://x/?q=acai&abertos=1&ordem=proximos&pagina=3'));
    expect(f).toMatchObject({ query: 'acai', openNow: true, sort: 'nearest', page: 3, featured: false });
    expect(parseListingParams(new URL('http://x/?pagina=-2')).page).toBe(1);
  });
});
