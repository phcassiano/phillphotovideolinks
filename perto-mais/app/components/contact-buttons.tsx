import { MessageCircle, Phone } from 'lucide-react';
import * as React from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { track } from '~/features/metrics/track';
import { formatPhoneBR } from '~/lib/phone';
import { productWhatsappLink, telLink, whatsappLink } from '~/lib/whatsapp';
import { cn } from '~/lib/utils';

type Contact = { id: string; name: string; whatsapp_e164: string | null; phone_e164: string | null; is_demo: boolean };

function DemoDialog({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (v: boolean) => void; kind: 'WhatsApp' | 'ligação' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Estabelecimento de demonstração" side="bottom">
        <p className="text-ink-muted">
          Este cadastro é fictício e serve só para mostrar como o site funciona. Por isso, o botão de {kind} não abre
          nenhum contato — assim nenhum número real é acionado.
        </p>
        <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppButton({
  business,
  productName,

  label = 'WhatsApp',
  className,
  size = 'md',
}: {
  business: Contact;
  productName?: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [demo, setDemo] = React.useState(false);
  if (!business.whatsapp_e164) return null;
  const href = productName ? productWhatsappLink(business.whatsapp_e164, productName) : whatsappLink(business.whatsapp_e164);
  return (
    <>
      <Button asChild variant="whatsapp" size={size} className={className}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label}: falar com ${business.name} pelo WhatsApp`}
          onClick={(e) => {
            if (business.is_demo) {
              e.preventDefault();
              setDemo(true);
              return;
            }
            track(business.id, 'whatsapp_click');
          }}
        >
          <MessageCircle aria-hidden />
          {label}
        </a>
      </Button>
      <DemoDialog open={demo} onOpenChange={setDemo} kind="WhatsApp" />
    </>
  );
}

export function CallButton({ business, className, size = 'md', showNumber = false }: { business: Contact; className?: string; size?: 'sm' | 'md' | 'lg'; showNumber?: boolean }) {
  const [demo, setDemo] = React.useState(false);
  const number = business.phone_e164 ?? business.whatsapp_e164;
  if (!number) return null;
  return (
    <>
      <Button asChild variant="secondary" size={size} className={cn(className)}>
        <a
          href={telLink(number)}
          aria-label={`Ligar para ${business.name}`}
          onClick={(e) => {
            if (business.is_demo) {
              e.preventDefault();
              setDemo(true);
              return;
            }
            track(business.id, 'phone_click');
          }}
        >
          <Phone aria-hidden />
          {showNumber ? formatPhoneBR(number) : 'Ligar'}
        </a>
      </Button>
      <DemoDialog open={demo} onOpenChange={setDemo} kind="ligação" />
    </>
  );
}
