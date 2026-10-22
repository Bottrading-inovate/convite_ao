import { createFileRoute } from '@tanstack/react-router';
import { WeddingInvitation } from '@/components/wedding/invitation';
export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Marque sua Presença.' },
    { name: 'description', content: 'Com a bênção de Jeová, Júnior e Hermenegilda convidam-vos para o seu casamento em Luanda, 12 de dezembro de 2026.' },
    { property: 'og:title', content: 'Marque sua Presença — Júnior & Hermenegilda' },
    { property: 'og:description', content: 'Um dia para celebrar o amor. Descobre a programação e confirma a tua presença.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});
function Index() { return <WeddingInvitation/>; }
