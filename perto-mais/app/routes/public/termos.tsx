import type { Route } from './+types/termos';
import { LegalPage } from '~/components/legal-page';
import { site } from '~/config/site';
import { seo } from '~/lib/seo';

export const meta: Route.MetaFunction = ({ matches }) => seo({ matches, title: 'Termos de uso', path: '/termos' });

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" updated="17/11/2026">
      <h2>1. O que é o {site.name}</h2>
      <p>
        O {site.name} é um guia de comércio local. Ajudamos moradores a encontrar estabelecimentos do bairro e a falar diretamente
        com eles. Não vendemos produtos, não intermediamos pedidos nem processamos pagamentos entre clientes e comerciantes.
      </p>
      <h2>2. Para quem navega</h2>
      <p>Você pode usar o site sem criar conta. As informações dos estabelecimentos são fornecidas pelos próprios comerciantes.</p>
      <ul>
        <li>Preços, horários e disponibilidade podem mudar; confirme com o estabelecimento.</li>
        <li>Negociações, entregas e pagamentos são feitos diretamente entre você e o comerciante.</li>
      </ul>
      <h2>3. Para comerciantes</h2>
      <ul>
        <li>Você declara que as informações cadastradas são verdadeiras e que tem direito de usar as imagens enviadas.</li>
        <li>Todo cadastro passa por análise antes de ser publicado e pode ser rejeitado ou suspenso se violar estes termos.</li>
        <li>É proibido anunciar produtos ou serviços ilegais, conteúdo ofensivo ou enganoso.</li>
        <li>O plano Vitrine é pago por período. Ao vencer sem renovação, o conteúdo exclusivo deixa de aparecer, mas não é apagado.</li>
      </ul>
      <h2>4. Responsabilidades</h2>
      <p>
        O {site.name} não se responsabiliza pela qualidade de produtos e serviços anunciados nem por acordos firmados entre clientes e
        comerciantes.
      </p>
      <h2>5. Contato</h2>
      <p>Dúvidas: {site.contactEmail}.</p>
    </LegalPage>
  );
}
