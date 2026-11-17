import { Outlet } from 'react-router';
import { BottomNav } from '~/components/bottom-nav';
import { SiteFooter } from '~/components/site-footer';
import { SiteHeader } from '~/components/site-header';

export default function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="min-h-[60dvh]">
        <Outlet />
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
