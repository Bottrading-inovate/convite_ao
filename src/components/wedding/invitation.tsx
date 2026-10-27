import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowDown,
  ArrowUpRight,
  CalendarPlus,
  Church,
  Heart,
  MapPin,
  Phone,
  Wine,
  Flower2,
  Download,
  QrCode,
  LoaderCircle,
  Info,
  Copy,
  Check,
  HandCoins,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lock,
  UtensilsCrossed,
  Eye,
  Coffee,
  Gift,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import botanicals from '@/assets/wedding-botanicals.png';
import coupleImg from '@/assets/couple.jpg';
import {
  countdownToWedding,
  decemberDays,
  invitationTokenSchema,
  receptionUrl,
  churchUrl,
  weddingPhones,
  officialSchedule,
  buildPasseUrl,
  weddingGifts,
} from '@/lib/wedding';
import { RsvpForm } from './rsvp-form';
import { lookupInvitation, confirmPersonalRsvp } from '@/lib/invitations.functions';

function addToCalendar() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Junior Hermenegilda//Wedding//PT',
    'BEGIN:VEVENT',
    'UID:junior-hermenegilda-20261212',
    'DTSTAMP:20261015T100000Z',
    'DTSTART:20261212T100000Z',
    'DTEND:20261212T230000Z',
    'SUMMARY:Casamento de Júnior e Hermenegilda',
    'LOCATION:Salão do Reino das Testemunhas de Jeová, Sonho da Casa Própria / Salão Detalhe Precioso',
    'DESCRIPTION:11h00 Cerimónia de Casamento Civil. 12h45 Discurso Bíblico de Casamento. 13h30 Coffee Break. 19h30 Copo-d’água (A Boda) no Salão Detalhe Precioso.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'junior-e-hermenegilda.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export function WeddingInvitation({
  guestName,
  token,
  initialAttending = null,
  initialPartySize = 1,
  tableName = null,
  invalid = false,
}: {
  guestName?: string | undefined;
  token?: string | undefined;
  initialAttending?: boolean | null | undefined;
  initialPartySize?: number | undefined;
  tableName?: string | null | undefined;
  invalid?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [countdown, setCountdown] = useState<number[] | null>(null);
  const [showRsvp, setShowRsvp] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState('');

  // Estado interativo de confirmação para o convite personalizado
  const [attendingStatus, setAttendingStatus] = useState<boolean | null>(initialAttending ?? null);
  const [partySize, setPartySize] = useState<number>(initialPartySize || 1);
  const [personalMessage, setPersonalMessage] = useState('');
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpFeedback, setRsvpFeedback] = useState('');

  const isPair = !!guestName && /\s(&|e)\s/i.test(guestName);
  const lookup = useServerFn(lookupInvitation);
  const confirmPersonalFn = useServerFn(confirmPersonalRsvp);
  const navigate = useNavigate();

  async function copyGift(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(id);
    window.setTimeout(() => setCopied(c => (c === id ? '' : c)), 2400);
  }

  useEffect(() => {
    const tick = () => setCountdown(countdownToWedding(Date.now()));
    tick();
    const interval = window.setInterval(tick, 1000);
    if (token) setInviteUrl(buildPasseUrl(token, typeof window !== 'undefined' ? window.location.origin : undefined));
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (initialAttending !== undefined && initialAttending !== null) {
      setAttendingStatus(initialAttending);
    }
    if (initialPartySize) {
      setPartySize(initialPartySize);
    }
  }, [initialAttending, initialPartySize]);

  async function consult(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let value = code.trim();
    if (value.startsWith('https://') || value.startsWith('http://')) {
      try {
        value = new URL(value).pathname.split('/').pop() ?? '';
      } catch {
        setError('Link inválido.');
        return;
      }
    }
    const result = invitationTokenSchema.safeParse(value);
    if (!result.success) {
      setError('Introduz o código completo ou o link que recebeste.');
      return;
    }
    setBusy(true);
    try {
      const guest = await lookup({ data: result.data });
      if (!guest) {
        setError('Convite não encontrado ou desativado. Contacta os noivos.');
        return;
      }
      await navigate({ to: '/convite/$token', params: { token: result.data } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o convite.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePersonalRsvpSubmit(attendingChoice: boolean) {
    if (!token) return;
    setRsvpSaving(true);
    setRsvpFeedback('');
    try {
      await confirmPersonalFn({
        data: {
          token,
          attending: attendingChoice,
          partySize: attendingChoice ? partySize : 1,
          message: personalMessage,
        },
      });
      setAttendingStatus(attendingChoice);
      setRsvpFeedback(
        attendingChoice
          ? 'Presença confirmada com sucesso! Mal podemos esperar por celebrar convosco. 💚'
          : 'Obrigado por nos avisares. Vamos sentir a tua falta neste dia especial! 💚'
      );
    } catch (err) {
      setRsvpFeedback(err instanceof Error ? err.message : 'Erro ao guardar confirmação.');
    } finally {
      setRsvpSaving(false);
    }
  }

  function downloadQr() {
    const svg = document.getElementById('guest-qr') as SVGSVGElement | null;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 600;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        const sanitized = guestName
          ? guestName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          : 'qr';
        a.download = `passe-convite-junior-hermenegilda-${sanitized}.png`;
        a.click();
      }
      URL.revokeObjectURL(blobUrl);
    };
    img.src = blobUrl;
  }

  return (
    <>
      {/* AVISO DE CRIANÇAS CONFORME ORIENTAÇÃO DOS NOIVOS */}
      <aside className="wedding-notice-top" aria-label="Observação importante">
        <p className="notice-inner">
          <Info size={15} aria-hidden="true" />
          <span><strong>OBS:</strong> Por favor, não levar crianças.</span>
        </p>
      </aside>

      <header className="wedding-nav">
        <a className="monogram" href="#inicio" aria-label="Júnior e Hermenegilda, início">
          J<span className="text-muted-foreground">&</span>H
        </a>
        <nav className="nav-links" aria-label="Convite">
          <a href="#dia">O grande dia</a>
          <a href="#programacao">Programação</a>
          <a href="#localizacoes">Localizações</a>
          {attendingStatus ? (
            <Button asChild variant="outline" className="wedding-cta text-green-800 border-green-700 bg-green-50/50">
              <a href="#presenca">
                <CheckCircle2 size={16} className="inline mr-1 text-green-600" />
                Presença confirmada
              </a>
            </Button>
          ) : attendingStatus === false ? (
            <Button asChild variant="outline" className="wedding-cta text-muted-foreground">
              <a href="#presenca">
                Resposta enviada
              </a>
            </Button>
          ) : (
            <Button asChild className="wedding-cta">
              <a href="#presenca">
                Confirmar presença <ArrowUpRight />
              </a>
            </Button>
          )}
        </nav>
      </header>

      <main>
        {/* HERO SECTION COM O ENVELOPE E A FOTO */}
        <section id="inicio" className="wedding-hero">
          <img src={botanicals} width={1024} height={1536} className="botanicals hero-botanical-left" alt="" />
          <img src={botanicals} width={1024} height={1536} className="botanicals hero-botanical-right" alt="" />
          <div className="hero-center">
            <blockquote className="hero-verse">
              “Agora, porém, permanecem estas três coisas: a fé, a esperança, o amor; mas a maior delas é o amor”
              <cite>1 Coríntios 13:13</cite>
            </blockquote>

            <p className="eyebrow">Com a bênção de Jeová e de seus pais</p>
            <h1 className="couple-title">
              Júnior <span className="ampersand">&</span>
              <span className="second-name"> Hermenegilda</span>
            </h1>

            {/* SECÇÃO OFICIAL DO MODELO DO CONVITE: TÊM A HONRA DE CONVIDAR */}
            <div className="guest-honor-card">
              <span className="guest-honor-caption">Têm a honra de Convidar:</span>
              <div className="guest-honor-badge">
                <h2 className="guest-honor-name">
                  {guestName || 'Queridos Familiares & Amigos'}
                </h2>
                {guestName && isPair && (
                  <span className="guest-honor-tag">2 Pessoas</span>
                )}
              </div>
            </div>

            <div className={`envelope-scene ${opened ? 'open' : ''}`}>
              <div className="envelope">
                <img
                  src={coupleImg}
                  className="envelope-photo"
                  width={768}
                  height={1152}
                  alt="Júnior e Hermenegilda juntos"
                />
                <Button
                  className="seal-button"
                  onClick={() => setOpened(true)}
                  aria-label="Abrir o nosso convite"
                  aria-expanded={opened}
                >
                  JH
                </Button>
                <span className="envelope-label">UM CONVITE FEITO COM AMOR · TOCAR PARA ABRIR</span>
              </div>
            </div>

            <div className="date-badge-box">
              <span className="date-badge-day-label">. SÁBADO .</span>
              <div className="date-badge-main">
                <span className="date-month">DEZEMBRO</span>
                <span className="date-day-number">12</span>
                <span className="date-year">2026</span>
              </div>
            </div>

            <a href="#dia" className="scroll-link">
              VER PROGRAMAÇÃO & DETALHES <ArrowDown size={16} />
            </a>
          </div>
        </section>

        {/* INTRODUÇÃO */}
        <section id="convite" className="intro-band">
          <Flower2 className="little-flower mx-auto" size={24} />
          <p className="eyebrow">Há momentos que merecem ser partilhados</p>
          <h2 className="section-title">
            {guestName
              ? isPair
                ? `${guestName}, este convite é para vós.`
                : `${guestName}, este convite é para ti.`
              : 'Querida família e amigos,'}
          </h2>
          <p className="intro-text">
            Com os corações cheios de alegria, temos a honra de vos convidar a celebrar a nossa união matrimonial. A vossa
            presença tornará este dia inesquecível e verdadeiramente abençoado.
          </p>
          {invalid && (
            <p className="error-copy mt-4">
              Este convite não foi encontrado ou foi desativado. Contacta os noivos para receberes o teu link oficial.
            </p>
          )}
        </section>

        {/* CALENDÁRIO E CONTAGEM DECRESCENTE */}
        <section id="dia" className="section-wrap date-grid">
          <div className="calendar">
            <div className="calendar-heading">
              Dezembro <span>2026</span>
            </div>
            <div className="calendar-grid">
              {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(d => (
                <div className="calendar-cell weekday" key={d}>
                  {d}
                </div>
              ))}
              {decemberDays().map((d, i) => (
                <div className={`calendar-cell ${d === 12 ? 'wedding-day' : ''}`} key={i}>
                  {d === 12 && <Heart />}
                  <span>{d}</span>
                </div>
              ))}
            </div>
            <p className="body-copy mt-5">Sábado, 12 de dezembro · Luanda</p>
          </div>

          <div>
            <p className="eyebrow">Cada vez mais perto</p>
            <h2 className="section-title">
              O início do nosso
              <br />
              para sempre.
            </h2>
            <div className="countdown" aria-label="Contagem decrescente para o casamento">
              {['dias', 'horas', 'minutos', 'segundos'].map((label, i) => (
                <div className="count-unit" key={label}>
                  <div className="count-number">{countdown ? String(countdown[i]).padStart(2, '0') : '—'}</div>
                  <div className="count-label">{label}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="wedding-cta" onClick={addToCalendar}>
              <CalendarPlus /> Guardar no calendário
            </Button>
          </div>
        </section>

        {/* PROGRAMAÇÃO CONFORME O MODELO PDF */}
        {/* PROGRAMAÇÃO CONFORME O MODELO OFICIAL */}
        <section id="programacao" className="programme-band">
          <p className="eyebrow">PROGRAMAÇÃO OFICIAL</p>
          <h2 className="section-title">O nosso grande dia</h2>
          <div className="timeline">
            {[
              {
                icon: Heart,
                time: '11:00 – 12:30',
                name: 'Cerimónia de Casamento Civil',
                detail: 'Conservatória / Celebração formal e assinatura perante a família',
                badge: 'Salão do Reino',
              },
              {
                icon: Church,
                time: '12:45 – 13:30',
                name: 'Discurso Bíblico de Casamento',
                detail: 'Salão do Reino das Testemunhas de Jeová (Com a bênção de Jeová)',
                badge: 'Salão do Reino',
              },
              {
                icon: Coffee,
                time: '13:30 – 14:45',
                name: 'Coffee Break',
                detail: 'Confraternização e carinho no Salão do Reino',
                badge: 'Salão do Reino',
              },
              {
                icon: Wine,
                time: '19:30',
                name: 'Copo-d’água (A Boda)',
                detail: 'Salão de Festas “Detalhe Precioso”',
                badge: 'Detalhe Precioso',
              },
            ].map(item => (
              <div className="timeline-item" key={item.time}>
                <div className="timeline-icon">
                  <item.icon size={22} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-time">{item.time}</div>
                  <div className="timeline-name">{item.name}</div>
                  <p className="timeline-detail">{item.detail}</p>
                  <span className="timeline-badge">{item.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LOCALIZAÇÕES DETALHADAS */}
        <section id="localizacoes" className="section-wrap locations">
          <p className="eyebrow">ENCONTRAMO-NOS AQUI</p>
          <h2 className="section-title">Os lugares do nosso sim</h2>
          <div className="location-grid">
            <article className="location-item">
              <Church size={24} />
              <p className="eyebrow mt-4">11h00 às 14h45 — Cerimónias & Coffee Break</p>
              <h3>Salão do Reino</h3>
              <p className="body-copy">
                As cerimónias (Civil, Discurso Bíblico e o Coffee Break) serão realizadas no Salão do Reino das Testemunhas de Jeová.
                <br />
                <strong>Localização:</strong> Sonho da casa própria, junto ao colégio dos marotos.
              </p>
              <Button variant="outline" className="wedding-cta mt-5" asChild>
                <a href={churchUrl} target="_blank" rel="noreferrer">
                  <MapPin /> Abrir no Mapa <ArrowUpRight />
                </a>
              </Button>
            </article>

            <article className="location-item">
              <Wine size={24} />
              <p className="eyebrow mt-4">19h30 — Copo-d’água (A Boda)</p>
              <h3>Detalhe Precioso</h3>
              <p className="body-copy">
                O Copo D’água (A Boda) será celebrado no Salão de Festas “Detalhe Precioso”.
                <br />
                <strong>Localização:</strong> Via Expressa sentido Kilamba–Zango na rua principal do Kixuxi Shopping.
              </p>
              <Button variant="outline" className="wedding-cta mt-5" asChild>
                <a href={receptionUrl} target="_blank" rel="noreferrer">
                  <MapPin /> Abrir no Mapa <ArrowUpRight />
                </a>
              </Button>
            </article>
          </div>
        </section>

        {/* CORES & TRAJE */}
        <section className="details-band">
          <div className="section-wrap dress-grid">
            <div>
              <p className="eyebrow">Pequenos detalhes, muito carinho</p>
              <h2 className="section-title">Em harmonia com o amor</h2>
              <p className="body-copy">
                Verde e branco são as cores da nossa celebração.
                <br />
                Para este dia especial, sugerimos um traje elegante e confortável.
              </p>
              <div className="dress-swatches" aria-label="Paleta da decoração: verde e branco">
                {[1, 2, 3, 4].map(n => (
                  <span className="swatch" key={n} />
                ))}
              </div>
              <p className="body-copy">
                Agradecemos que cheguem com antecedência às cerimónias, para partilharmos cada momento com tranquilidade.
              </p>
            </div>
            <blockquote className="quote">
              “Agora, porém, permanecem estas três coisas: a fé, a esperança, o amor; mas a maior delas é o amor.”
              <cite className="quote-source">1 Coríntios 13:13</cite>
            </blockquote>
          </div>
        </section>

        {/* CONFIRMAÇÃO DE PRESENÇA (RSVP) */}
        <section id="presenca" className="section-wrap rsvp-section">
          <Flower2 className="little-flower mx-auto" size={24} />
          <p className="eyebrow">
            {attendingStatus !== null ? 'Presença Registada' : 'O melhor presente é a tua presença'}
          </p>
          <h2 className="section-title">
            {attendingStatus !== null ? 'A tua presença no nosso casamento' : 'Vens celebrar connosco?'}
          </h2>

          {/* FLUXO 1: CONVIDADO COM CONVITE PESSOAL (TOKEN) */}
          {token && guestName ? (
            <div className="personal-rsvp-box">
              <div className="personal-rsvp-header">
                <Sparkles size={20} className="text-primary mx-auto mb-2" />
                <h3 className="text-xl font-serif text-primary">Confirmação de Presença</h3>
                <p className="body-copy">
                  Convite emitido para: <strong>{guestName}</strong>
                </p>
              </div>

              {attendingStatus !== null ? (
                <div className="rsvp-confirmed-badge">
                  {attendingStatus ? (
                    <div className="status-confirmed-card">
                      <CheckCircle2 size={40} className="text-green-600 mx-auto mb-2" />
                      <h4 className="font-semibold text-green-900 text-xl font-serif">Presença Confirmada!</h4>
                      <p className="text-sm text-green-800 mt-2">
                        Estimado(a) <strong>{guestName}</strong>, a tua presença já se encontra confirmada com {partySize} {partySize === 1 ? 'lugar garantido' : 'lugares garantidos'}.
                      </p>
                      <p className="text-xs text-green-700 mt-2">
                        Não precisas de confirmar novamente. Os teus lugares estão reservados e contamos contigo para celebrar este dia tão especial!
                      </p>
                      <div className="mt-5 flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="wedding-cta text-green-900 border-green-600 bg-white"
                          onClick={addToCalendar}
                        >
                          <CalendarPlus size={16} className="mr-1.5 inline" />
                          Adicionar à minha agenda
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="status-declined-card">
                      <XCircle size={40} className="text-red-500 mx-auto mb-2" />
                      <h4 className="font-semibold text-red-900 text-xl font-serif">Resposta Registada</h4>
                      <p className="text-sm text-red-700 mt-2">
                        Estimado(a) <strong>{guestName}</strong>, registámos que não poderás comparecer.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        A tua resposta foi registada com sucesso. Agradecemos imenso o carinho e consideração de nos avisares!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="personal-rsvp-interactive">
                  <p className="body-copy text-center mb-5">
                    Por favor, confirma a tua disponibilidade para garantirmos o vosso lugar no Copo-d'água:
                  </p>

                  <div className="rsvp-choice-large">
                    <Button
                      type="button"
                      className="wedding-cta rsvp-yes-btn"
                      onClick={() => handlePersonalRsvpSubmit(true)}
                      disabled={rsvpSaving}
                    >
                      {rsvpSaving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 size={18} />}
                      <span>Sim, estarei presente</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="wedding-cta rsvp-no-btn"
                      onClick={() => handlePersonalRsvpSubmit(false)}
                      disabled={rsvpSaving}
                    >
                      <XCircle size={18} />
                      <span>Não poderei ir</span>
                    </Button>
                  </div>

                  <div className="personal-rsvp-options mt-5">
                    <label className="rsvp-label text-left">
                      Número de Pessoas (Adultos)
                      <select
                        className="lookup-input mt-1"
                        value={partySize}
                        onChange={e => setPartySize(Number(e.target.value))}
                      >
                        <option value={1}>1 pessoa (individual)</option>
                        <option value={2}>2 pessoas (com acompanhante)</option>
                      </select>
                    </label>

                    <label className="rsvp-label text-left mt-3">
                      Mensagem aos noivos (opcional)
                      <textarea
                        className="lookup-input mt-1"
                        rows={2}
                        placeholder="Deixa uma mensagem ou voto de felicidades..."
                        value={personalMessage}
                        onChange={e => setPersonalMessage(e.target.value)}
                        maxLength={500}
                      />
                    </label>
                  </div>
                </div>
              )}

              {rsvpFeedback && <p className="success-copy mt-3">{rsvpFeedback}</p>}

              {/* QR CODE EXCLUSIVO DE ACESSO */}
              <div className="guest-pass mt-8">
                <QrCode size={22} />
                <h3 className="section-title text-2xl">O teu passe digital</h3>
                <p className="body-copy">Apresenta este código QR na entrada do Salão de Festas para validação da portaria.</p>
                {tableName && (
                  <div className="my-2 py-1.5 px-3 bg-secondary/70 border border-border rounded-md text-sm text-primary inline-flex items-center gap-1.5">
                    <UtensilsCrossed size={14} />
                    <span>Mesa reservada: <strong>{tableName}</strong></span>
                  </div>
                )}
                <div className="p-3 bg-white rounded-lg shadow-sm border border-border">
                  <QRCodeSVG id="guest-qr" value={inviteUrl} size={170} marginSize={3} />
                </div>
                <div className="flex gap-3 flex-wrap justify-center items-center">
                  <Button variant="outline" className="wedding-cta" onClick={downloadQr}>
                    <Download /> Guardar QR Code (PNG)
                  </Button>
                </div>
                {token && (
                  <p className="mt-2">
                    <a
                      href={`/passe/${token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline inline-flex items-center gap-1 hover:opacity-80"
                    >
                      <Eye size={13} /> Ver o passe que a portaria verá ao escanear
                    </a>
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* FLUXO 2: CONVIDADO NO LINK PÚBLICO GERAL */
            <>
              <p className="body-copy">
                Será uma alegria ter-te ao nosso lado neste dia tão especial.
              </p>
              <Button
                className="wedding-cta mt-6"
                onClick={() => setShowRsvp(v => !v)}
                aria-expanded={showRsvp}
              >
                {showRsvp ? 'Fechar confirmação' : 'Confirmar a minha presença'}
                <ArrowUpRight />
              </Button>

              {showRsvp && <RsvpForm defaultName="" />}

              <div className="guest-pass">
                <QrCode size={22} />
                <p className="body-copy">Já recebeste o teu convite pessoal ou tens um link?</p>
                <form className="lookup-form" onSubmit={consult}>
                  <input
                    className="lookup-input"
                    aria-label="Código ou link do convite"
                    placeholder="Cola aqui o teu link ou código de 64 caracteres"
                    value={code}
                    maxLength={500}
                    onChange={e => setCode(e.target.value)}
                  />
                  <Button className="wedding-cta" type="submit" disabled={busy}>
                    {busy && <LoaderCircle className="animate-spin" />}
                    Consultar convite
                  </Button>
                </form>
                {error && <p role="alert" className="error-copy">{error}</p>}
              </div>
            </>
          )}
        </section>

        {/* PRESENTES / GESTO DE CARINHO */}
        <section id="presente" className="gift-band">
          <HandCoins className="little-flower mx-auto" size={24} aria-hidden="true" />
          <p className="eyebrow">UM GESTO DE CARINHO</p>
          <h2 className="section-title">Abençoar o nosso novo lar</h2>
          <p className="intro-text max-w-xl mx-auto">
            A vossa presença é a nossa maior bênção e alegria! Se desejarem presentear os noivos ou contribuir
            com um gesto de carinho para o início do nosso lar e lua de mel, preparamos com amor as opções abaixo.
            Toca em qualquer cartão para copiar os dados.
          </p>

          {/* SUGESTÕES CARINHOSAS / COTAS AFETIVAS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto my-6 text-center">
            <div className="p-3.5 rounded-lg border border-border bg-white/70 shadow-xs flex flex-col items-center">
              <Coffee size={22} className="text-primary mb-1.5" />
              <span className="text-xs font-semibold text-primary">Pequeno-almoço</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Mimo na Lua de Mel</span>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-white/70 shadow-xs flex flex-col items-center">
              <Heart size={22} className="text-primary mb-1.5" />
              <span className="text-xs font-semibold text-primary">Novo Lar</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Detalhe para a casa</span>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-white/70 shadow-xs flex flex-col items-center">
              <Wine size={22} className="text-primary mb-1.5" />
              <span className="text-xs font-semibold text-primary">Jantar Romântico</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Celebração a dois</span>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-white/70 shadow-xs flex flex-col items-center">
              <Gift size={22} className="text-primary mb-1.5" />
              <span className="text-xs font-semibold text-primary">Cota Livre</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Qualquer valor de amor</span>
            </div>
          </div>

          <div className="gift-grid">
            <button
              type="button"
              className={`gift-card ${copied === 'express' ? 'copied' : ''}`}
              onClick={() => copyGift(weddingGifts.expressNumber, 'express')}
              aria-label="Copiar o número Multicaixa Express"
            >
              <span className="gift-label font-semibold text-primary">★ Multicaixa Express (Recomendado)</span>
              <span className="gift-value text-lg font-bold">{weddingGifts.expressDisplay}</span>
              <span className="gift-hint">
                {copied === 'express' ? <><Check size={14} /> Número copiado!</> : <><Copy size={14} /> Toca para copiar o telemóvel</>}
              </span>
            </button>

            <button
              type="button"
              className={`gift-card ${copied === 'noivo' ? 'copied' : ''}`}
              onClick={() => copyGift(weddingGifts.groomIban, 'noivo')}
              aria-label="Copiar o IBAN do noivo"
            >
              <span className="gift-label">IBAN do Noivo ({weddingGifts.groomName})</span>
              <span className="gift-value">{weddingGifts.groomIban}</span>
              <span className="gift-hint">
                {copied === 'noivo' ? <><Check size={14} /> IBAN copiado!</> : <><Copy size={14} /> Toca para copiar o IBAN</>}
              </span>
            </button>

            <button
              type="button"
              className={`gift-card ${copied === 'noiva' ? 'copied' : ''}`}
              onClick={() => copyGift(weddingGifts.brideIban, 'noiva')}
              aria-label="Copiar o IBAN da noiva"
            >
              <span className="gift-label">IBAN da Noiva ({weddingGifts.brideName})</span>
              <span className="gift-value">{weddingGifts.brideIban}</span>
              <span className="gift-hint">
                {copied === 'noiva' ? <><Check size={14} /> IBAN copiado!</> : <><Copy size={14} /> Toca para copiar o IBAN</>}
              </span>
            </button>
          </div>

          {/* BOTÃO PARA ENVIAR COMPROVATIVO / MENSAGEM */}
          <div className="mt-6 flex justify-center">
            <Button variant="outline" className="wedding-cta gap-2 text-xs" asChild>
              <a
                href={`https://wa.me/${weddingGifts.whatsappProofPhone}?text=${encodeURIComponent('Olá Júnior e Hermenegilda! Fiz uma contribuição com todo o carinho para o vosso casamento. Muitas felicidades e que Jeová vos abençoe!')}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageSquare size={16} /> Enviar comprovativo ou mensagem aos noivos
              </a>
            </Button>
          </div>

          <p className="gift-thanks mt-6">
            A vossa presença e o vosso carinho significam tudo para nós.
            <br />
            Estamos ansiosos para celebrar este dia inesquecível ao vosso lado.
            <br />
            Até breve!
          </p>
        </section>
      </main>

      {/* RODAPÉ */}
      <footer id="contactos" className="contact-footer">
        <p className="eyebrow">ESTAMOS POR PERTO</p>
        <h2 className="section-title">Precisas de ajuda?</h2>
        <div className="contact-links">
          {weddingPhones.map(phone => (
            <Button key={phone} variant="outline" className="wedding-cta" asChild>
              <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                <Phone /> {phone}
              </a>
            </Button>
          ))}
        </div>
        <p className="footer-name">Júnior & Hermenegilda</p>
        <p className="footer-note">12 de dezembro de 2026 · Com amor</p>
        <div className="admin-footer-wrap">
          <a href="/painel" className="admin-footer-link">
            <Lock size={12} aria-hidden="true" /> Área dos Noivos
          </a>
        </div>
      </footer>
    </>
  );
}