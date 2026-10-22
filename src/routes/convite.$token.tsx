import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { WeddingInvitation } from '@/components/wedding/invitation';
import { lookupInvitation } from '@/lib/invitations.functions';
import { invitationTokenSchema } from '@/lib/wedding';
const invitationQuery = (token: string) => queryOptions({
  queryKey: ['invitation', token],
  queryFn: () => invitationTokenSchema.safeParse(token).success ? lookupInvitation({ data: token }) : Promise.resolve(null),
  retry: false,
});
export const Route = createFileRoute('/convite/$token')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(invitationQuery(params.token)),
  head: () => ({ meta: [
    { title: 'O teu convite — Marque sua Presença.' },
    { name: 'description', content: 'O teu convite pessoal para celebrar o casamento de Júnior e Hermenegilda em 12 de dezembro de 2026.' },
    { property: 'og:title', content: 'Um convite especial — Júnior & Hermenegilda' },
    { property: 'og:description', content: 'Contamos contigo para celebrar o nosso amor em 12 de dezembro de 2026.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' },
  ] }),
  component: PersonalInvitation,
});
function PersonalInvitation() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(invitationQuery(token));
  return (
    <WeddingInvitation
      guestName={data?.name}
      token={data ? token : undefined}
      initialAttending={data?.attending}
      initialPartySize={data?.partySize}
      invalid={!data}
    />
  );
}