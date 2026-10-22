import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { lookupInvitation } from '@/lib/invitations.functions';
import { invitationTokenSchema } from '@/lib/wedding';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  MapPin,
  Calendar,
  UtensilsCrossed,
  Info,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import botanicals from '@/assets/wedding-botanicals.png';
import { Button } from '@/components/ui/button';

const invitationQuery = (token: string) =>
  queryOptions({
    queryKey: ['invitation', token],
    queryFn: () =>
      invitationTokenSchema.safeParse(token).success
        ? lookupInvitation({ data: token })
        : Promise.resolve(null),
    retry: false,
  });

export const Route = createFileRoute('/passe/$token')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(invitationQuery(params.token)),
  head: () => ({
    meta: [
      { title: 'Passe Digital — Controlo de Portaria | Júnior & Hermenegilda' },
      {
        name: 'description',
        content: 'Verificação do passe digital de acesso e mesa para a recepção de casamento.',
      },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: PassePortariaPage,
});

function PassePortariaPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(invitationQuery(token));

  return (
    <div className="passe-page-wrapper">
      <div className="passe-bg-decorations" aria-hidden="true">
        <img src={botanicals} className="passe-botanical-top" alt="" />
        <img src={botanicals} className="passe-botanical-bottom" alt="" />
      </div>

      <main className="passe-container">
        {/* Cabeçalho */}
        <header className="passe-header">
          <div className="monogram">
            J<span className="text-muted-foreground">&</span>H
          </div>
          <h1 className="passe-title">Casamento de Júnior & Hermenegilda</h1>
          <p className="passe-subtitle">
            <ShieldCheck size={16} className="inline mr-1 text-primary" />
            Passe Digital de Acesso • Controlo de Entrada
          </p>
        </header>

        {!data ? (
          <div className="passe-card is-invalid">
            <XCircle size={48} className="text-destructive mb-3" />
            <h2 className="passe-status-title text-destructive">Convite Inválido ou Não Encontrado</h2>
            <p className="body-copy mt-2">
              Este código de acesso não consta no sistema ou foi desativado. Por favor, solicita a verificação manual aos noivos ou à equipa de receção.
            </p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/">Ir para a página principal</Link>
              </Button>
            </div>
          </div>
        ) : (
          <article className="passe-card">
            {/* Status da Portaria */}
            <div
              className={`passe-status-badge ${
                data.attending === true
                  ? 'status-confirmed'
                  : data.attending === false
                    ? 'status-declined'
                    : 'status-pending'
              }`}
            >
              {data.attending === true ? (
                <>
                  <CheckCircle2 size={24} className="status-icon text-green-700" />
                  <div>
                    <strong className="status-label text-green-900">ENTRADA AUTORIZADA</strong>
                    <p className="status-desc text-green-800">Presença confirmada no sistema</p>
                  </div>
                </>
              ) : data.attending === false ? (
                <>
                  <XCircle size={24} className="status-icon text-destructive" />
                  <div>
                    <strong className="status-label text-destructive">PRESENÇA RECUSADA</strong>
                    <p className="status-desc text-muted-foreground">O convidado assinalou que não comparece</p>
                  </div>
                </>
              ) : (
                <>
                  <Clock size={24} className="status-icon text-amber-600" />
                  <div>
                    <strong className="status-label text-amber-800">RESPOSTA PENDENTE</strong>
                    <p className="status-desc text-amber-700">Ainda não respondeu à confirmação no site</p>
                  </div>
                </>
              )}
            </div>

            {/* Nome do Convidado em Grande Destaque */}
            <section className="passe-section passe-guest-highlight">
              <span className="passe-label">CONVIDADO(S) NOMINADO(S)</span>
              <h2 className="passe-guest-name">{data.name}</h2>
            </section>

            {/* Grid de Informações Cruciais para o Porteiro */}
            <div className="passe-info-grid">
              {/* Lotação */}
              <div className="passe-info-box">
                <span className="passe-label flex items-center gap-1">
                  <Users size={14} /> Lotação Autorizada
                </span>
                <p className="passe-info-val">
                  {data.partySize === 1 ? '1 Pessoa (Individual)' : '2 Pessoas (Casal / Acompanhante)'}
                </p>
              </div>

              {/* Mesa Atribuída */}
              <div className={`passe-info-box ${data.tableName ? 'is-table-highlight' : ''}`}>
                <span className="passe-label flex items-center gap-1">
                  <UtensilsCrossed size={14} /> Mesa Reservada
                </span>
                <p className="passe-info-val text-primary font-semibold text-lg">
                  {data.tableName ? (
                    <span className="table-chip">
                      <Sparkles size={14} className="inline mr-1 text-gold" />
                      {data.tableName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">A designar na receção</span>
                  )}
                </p>
              </div>
            </div>

            {/* Aviso de Crianças */}
            <div className="passe-notice">
              <Info size={15} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Aviso do Evento:</strong> Por favor, não levar crianças.
              </span>
            </div>

            {/* Local e Horário */}
            <div className="passe-event-details">
              <div className="passe-detail-row">
                <Calendar size={15} className="text-primary" />
                <span>Sábado, 12 de Dezembro de 2026</span>
              </div>
              <div className="passe-detail-row">
                <MapPin size={15} className="text-primary" />
                <span>Copo-d'água às 19h30 • Salão de Festas "Detalhe Precioso"</span>
              </div>
            </div>

            {/* Ações */}
            <div className="passe-actions">
              <Button asChild variant="outline" className="wedding-cta w-full">
                <Link to="/convite/$token" params={{ token }}>
                  Ver convite completo com programação <ExternalLink size={15} className="ml-1" />
                </Link>
              </Button>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
