import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rsvpSchema, submitRsvp } from '@/lib/invitations.functions';

export function RsvpForm({ defaultName = '' }: { defaultName?: string }) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState(true);
  const [guests, setGuests] = useState(/\s(&|e)\s/i.test(defaultName) ? 2 : 1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const submit = useServerFn(submitRsvp);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = rsvpSchema.safeParse({ name, phone, attending, guests, message });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Verifica os dados.'); return; }
    setBusy(true);
    try {
      const row = await submit({ data: parsed.data });
      if (row.attending) await navigate({ to: '/convite/$token', params: { token: row.token }, hash: 'presenca' });
      else setDeclined(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível guardar.'); }
    finally { setBusy(false); }
  }

  if (declined) return <p className="body-copy rsvp-done">Obrigado por nos avisares. Vamos sentir a tua falta! 💚</p>;

  return (
    <form className="rsvp-form" onSubmit={onSubmit}>
      <label className="rsvp-label">Nome para o convite
        <input className="lookup-input" value={name} maxLength={120} placeholder="Ex.: Jorge & Marta, Pedro & Esposa" onChange={e => { setName(e.target.value); if (/\s(&|e)\s/i.test(e.target.value)) setGuests(2); }} required/>
      </label>
      <label className="rsvp-label">Telemóvel / WhatsApp
        <input className="lookup-input" type="tel" value={phone} maxLength={20} placeholder="+244 9XX XXX XXX" onChange={e => setPhone(e.target.value)} required/>
      </label>
      <div className="rsvp-choice" role="radiogroup" aria-label="Presença">
        <Button type="button" variant={attending ? 'default' : 'outline'} className="wedding-cta" onClick={() => setAttending(true)} aria-pressed={attending}>Sim, estarei presente</Button>
        <Button type="button" variant={!attending ? 'default' : 'outline'} className="wedding-cta" onClick={() => setAttending(false)} aria-pressed={!attending}>Não poderei ir</Button>
      </div>
      {attending && <label className="rsvp-label">Número de pessoas (adultos)
        <select className="lookup-input" value={guests} onChange={e => setGuests(Number(e.target.value))}><option value={1}>1 pessoa</option><option value={2}>2 pessoas</option></select>
      </label>}
      <label className="rsvp-label">Mensagem aos noivos (opcional)
        <textarea className="lookup-input" rows={3} maxLength={500} value={message} onChange={e => setMessage(e.target.value)}/>
      </label>
      {error && <p role="alert" className="error-copy">{error}</p>}
      <Button className="wedding-cta" type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin"/>}Enviar confirmação</Button>
    </form>
  );
}
