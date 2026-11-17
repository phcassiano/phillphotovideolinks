import type { Route } from './+types/privacidade';
import { LegalPage } from '~/components/legal-page';
import { site } from '~/config/site';
import { seo } from '~/lib/seo';

export const meta: Route.MetaFunction = ({ matches }) => seo({ matches, title: 'Política de privacidade', path: '/privacidade' });

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" updated="17/11/2026">
      <p>
        Esta política explica quais dados o {site.name} coleta e por quê, em linha com a Lei Geral de Proteção de Dados (Lei
        13.709/2018). Coletamos o mínimo necessário.
      </p>
      <h2>Visitantes</h2>
      <ul>
        <li>Não pedimos cadastro para navegar.</li>
        <li>
          Guardamos em cookies, no seu aparelho, a cidade e o bairro escolhidos e — só se você tocar em “Usar minha localização” — uma
          posição aproximada (cerca de 100 metros) por 7 dias, para mostrar distâncias.
        </li>
        <li>
          Para contar visitas e cliques de forma anônima, usamos um identificador aleatório de sessão (12 horas). Armazenamos apenas
          um código embaralhado, sem nome, e-mail ou endereço IP.
        </li>
      </ul>
      <h2>Comerciantes</h2>
      <ul>
        <li>Dados da conta: nome do responsável, e-mail, telefone e senha (armazenada de forma criptografada pelo provedor de autenticação).</li>
        <li>Dados do negócio que você decide publicar: nome, endereço, contatos, horários, fotos e produtos.</li>
        <li>Usamos esses dados para exibir seu negócio, falar com você sobre o cadastro e a assinatura, e prevenir fraudes.</li>
      </ul>
      <h2>Compartilhamento</h2>
      <p>
        Não vendemos dados. Usamos provedores de infraestrutura (hospedagem e banco de dados) que tratam os dados em nosso nome. Mapas
        são carregados do OpenStreetMap, que recebe o endereço IP de quem visualiza o mapa.
      </p>
      <h2>Seus direitos</h2>
      <ul>
        <li>Acessar, corrigir e excluir seus dados.</li>
        <li>Excluir a conta a qualquer momento pelo painel, em “Minha conta”. A exclusão remove o negócio, as fotos e os produtos.</li>
        <li>Para outros pedidos: {site.contactEmail}.</li>
      </ul>
    </LegalPage>
  );
}
