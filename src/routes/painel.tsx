import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  adminGetStatus,
  adminSetupPassword,
  adminLogin,
  adminLogout,
  adminChangePassword,
  adminGetDashboard,
  adminCreateGuests,
  adminDeleteGuest,
  adminUpdateGuest,
  adminSetGuestTable,
  type GuestRow,
  type DashboardStats,
} from '@/lib/invitations.functions';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Copy,
  Check,
  Send,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  LogOut,
  KeyRound,
  Search,
  RefreshCw,
  MessageCircle,
  Phone,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  X,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import botanicals from '@/assets/wedding-botanicals.png';

export const Route = createFileRoute('/painel')({
  head: () => ({
    meta: [
      { title: 'Área dos Noivos — Gestão de Convites' },
      { name: 'description', content: 'Área reservada aos noivos para emitir convites e acompanhar as confirmações.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: AdminPanelPage,
});

const SESSION_KEY = 'wedding_admin_session';
type Screen = 'checking' | 'setup' | 'login' | 'dashboard';

function errorText(err: unknown, fallback: string) {
  if (!err) return fallback;
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj['message'] === 'string' && obj['message']) return obj['message'];
    if (typeof obj['data'] === 'string' && obj['data']) return obj['data'];
    if (obj['data'] && typeof (obj['data'] as Record<string, unknown>)['message'] === 'string') {
      return (obj['data'] as Record<string, unknown>)['message'] as string;
    }
  }
  return fallback;
}

function PasswordField({
  id, label, value, onChange, autoComplete, hint, autoFocus,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete: string; hint?: string; autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="admin-field">
      <label htmlFor={id} className="admin-label">{label}</label>
      <div className="admin-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="admin-input"
          value={value}
          maxLength={128}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="admin-password-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p className="admin-hint">{hint}</p>}
    </div>
  );
}

function passwordProblem(pw: string) {
  if (pw.length < 10) return 'Usa pelo menos 10 caracteres.';
  if (!/[A-Za-z]/.test(pw)) return 'Inclui pelo menos uma letra.';
  if (!/[0-9]/.test(pw)) return 'Inclui pelo menos um número.';
  return '';
}

function AdminPanelPage() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [session, setSession] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Autenticação
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Painel
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [activeTab, setActiveTab] = useState<'guests' | 'tables' | 'create'>('guests');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [tableModalGuest, setTableModalGuest] = useState<GuestRow | null>(null);
  const [tableModalValue, setTableModalValue] = useState('');

  function openTableModal(guest: GuestRow) {
    setTableModalGuest(guest);
    setTableModalValue(guest.tableName || '');
  }

  async function saveTableModal() {
    if (!tableModalGuest) return;
    await handleSetTable(tableModalGuest, tableModalValue);
    setTableModalGuest(null);
  }

  // Emissão
  const [bulkText, setBulkText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singlePartySize, setSinglePartySize] = useState<number>(2);

  // Alterar palavra-passe
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  const getStatusFn = useServerFn(adminGetStatus);
  const setupFn = useServerFn(adminSetupPassword);
  const loginFn = useServerFn(adminLogin);
  const logoutFn = useServerFn(adminLogout);
  const changePwFn = useServerFn(adminChangePassword);
  const getDashboardFn = useServerFn(adminGetDashboard);
  const createGuestsFn = useServerFn(adminCreateGuests);
  const deleteGuestFn = useServerFn(adminDeleteGuest);
  const updateGuestFn = useServerFn(adminUpdateGuest);
  const setTableFn = useServerFn(adminSetGuestTable);

  useEffect(() => {
    // Remove o PIN antigo guardado em versões anteriores.
    localStorage.removeItem('wedding_admin_pin');
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      setSession(cached);
      loadDashboard(cached);
      return;
    }
    checkStatus();
  }, []);

  async function checkStatus() {
    setError('');
    try {
      const { configured } = await getStatusFn();
      setScreen(configured ? 'login' : 'setup');
    } catch (err) {
      setScreen('login');
      setError(errorText(err, 'Não foi possível ligar à base de dados.'));
    }
  }

  function startSession(token: string) {
    sessionStorage.setItem(SESSION_KEY, token);
    setSession(token);
    setPassword('');
    setPasswordConfirm('');
    setSetupCode('');
    loadDashboard(token);
  }

  function endSession(message = '') {
    sessionStorage.removeItem(SESSION_KEY);
    setSession('');
    setStats(null);
    setGuests([]);
    setShowPasswordPanel(false);
    setError(message);
    setScreen('login');
  }

  async function loadDashboard(token: string) {
    setLoading(true);
    try {
      const data = await getDashboardFn({ data: { session: token } });
      setStats(data.stats);
      setGuests(data.guests);
      setScreen('dashboard');
    } catch (err) {
      const msg = errorText(err, 'Não foi possível carregar o painel.');
      if (/Sessão/i.test(msg)) {
        sessionStorage.removeItem(SESSION_KEY);
        setSession('');
        await checkStatus();
        setError(msg);
      } else if (screen === 'dashboard') {
        setNotice(msg);
      } else {
        setScreen('login');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== passwordConfirm) return setError('As palavras-passe não coincidem.');
    setLoading(true);
    try {
      const { session: token } = await setupFn({ data: { setupCode, password } });
      startSession(token);
    } catch (err) {
      setError(errorText(err, 'Não foi possível criar a palavra-passe.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { session: token } = await loginFn({ data: { password } });
      startSession(token);
    } catch (err) {
      setError(errorText(err, 'Palavra-passe incorreta.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { if (session) await logoutFn({ data: { session } }); } catch { /* a sessão expira sozinha */ }
    endSession();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage('');
    const problem = passwordProblem(newPw);
    if (problem) return setPwMessage(problem);
    setLoading(true);
    try {
      await changePwFn({ data: { session, current: currentPw, next: newPw } });
      setCurrentPw('');
      setNewPw('');
      setShowPasswordPanel(false);
      setNotice('Palavra-passe alterada. As outras sessões abertas foram terminadas.');
    } catch (err) {
      const msg = errorText(err, 'Não foi possível alterar a palavra-passe.');
      if (/Sessão/i.test(msg)) return endSession(msg);
      setPwMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  function guardSession(err: unknown, fallback: string) {
    const msg = errorText(err, fallback);
    if (/Sessão/i.test(msg)) endSession(msg);
    else setNotice(msg);
  }

  async function handleCreateGuests(e: React.FormEvent) {
    e.preventDefault();
    setNotice('');
    const items: Array<{ name: string; phone?: string; partySize: number }> = [];

    if (activeTab === 'create' && bulkText.trim() && (e.currentTarget as HTMLElement).id === 'bulk-form') {
      for (const line of bulkText.split('\n').map(l => l.trim()).filter(Boolean)) {
        const [name = '', phone, size] = line.split(/[,;\t]/).map(p => p.trim());
        const parsed = Number.parseInt(size ?? '', 10);
        const partySize = parsed === 1 || parsed === 2 ? parsed : /\s(&|e)\s/i.test(name) ? 2 : 1;
        if (name.length >= 2) items.push({ name, phone: phone || undefined, partySize });
      }
    } else if (singleName.trim()) {
      items.push({ name: singleName.trim(), phone: singlePhone.trim() || undefined, partySize: singlePartySize });
    }

    if (items.length === 0) return setNotice('Introduz pelo menos o nome de um convidado.');

    setLoading(true);
    try {
      const result = await createGuestsFn({ data: { session, items } });
      setBulkText('');
      setSingleName('');
      setSinglePhone('');
      await loadDashboard(session);
      setActiveTab('guests');
      setStatusFilter('all');
      setNotice(`${result.count} ${result.count === 1 ? 'convite emitido' : 'convites emitidos'}. Já podem ser enviados por WhatsApp.`);
    } catch (err) {
      guardSession(err, 'Não foi possível emitir os convites.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(guest: GuestRow) {
    if (!confirm(`Apagar o convite de "${guest.name}"? O link deixará de funcionar.`)) return;
    try {
      await deleteGuestFn({ data: { session, token: guest.token } });
      await loadDashboard(session);
    } catch (err) {
      guardSession(err, 'Não foi possível apagar o convidado.');
    }
  }

  async function handleSetStatus(guest: GuestRow, attending: boolean | null) {
    try {
      await updateGuestFn({
        data: { session, token: guest.token, name: guest.name, phone: guest.phone, partySize: guest.partySize, attending },
      });
      await loadDashboard(session);
    } catch (err) {
      guardSession(err, 'Não foi possível atualizar o convidado.');
    }
  }

  async function handleSetTable(guest: GuestRow, table: string) {
    const val = table.trim();
    try {
      await setTableFn({ data: { session, token: guest.token, tableName: val || null } });
      setGuests(prev => prev.map(g => (g.id === guest.id ? { ...g, tableName: val || null } : g)));
      setNotice(`Mesa de ${guest.name} definida como "${val || 'Sem mesa'}".`);
    } catch (err) {
      guardSession(err, 'Não foi possível atribuir a mesa.');
    }
  }

  function inviteLink(token: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/convite/${token}`;
  }

  function passeLink(token: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/passe/${token}`;
  }

  async function copyInviteLink(token: string) {
    try { await navigator.clipboard.writeText(inviteLink(token)); } catch { /* sem permissão de cópia */ }
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(c => (c === token ? null : c)), 2400);
  }

  function whatsAppUrl(guest: GuestRow) {
    const link = inviteLink(guest.token);
    const text =
      guest.attending === true
        ? `Olá ${guest.name}! Ficámos muito felizes com a vossa confirmação para o nosso casamento, a 12 de dezembro de 2026.\n\nO vosso convite digital, com o código QR de entrada, está aqui:\n${link}`
        : `Olá ${guest.name}! Com a bênção de Jeová e de nossos pais, nós, Júnior & Hermenegilda, temos a honra de vos convidar para o nosso casamento, no dia 12 de dezembro de 2026.\n\nO vosso convite pessoal está aqui:\n${link}\n\nPedimos que confirmem a presença no próprio convite. Por favor, não levem crianças.`;
    const digits = (guest.phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  function downloadCsv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Nome', 'Telefone', 'Pessoas', 'Estado', 'Mesa', 'Mensagem', 'Data da resposta', 'Link do convite', 'Link do passe'];
    const rows = guests.map(g => [
      q(g.name),
      q(g.phone || ''),
      g.partySize,
      g.attending === true ? 'Confirmado' : g.attending === false ? 'Não vai' : 'Aguarda resposta',
      q(g.tableName || 'Sem mesa'),
      q(g.message || ''),
      q(g.respondedAt ? new Date(g.respondedAt).toLocaleDateString('pt-AO') : ''),
      q(inviteLink(g.token)),
      q(passeLink(g.token)),
    ]);
    const csv = '\uFEFF' + [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `convidados-junior-hermenegilda-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const existingTables = useMemo(() => {
    const set = new Set<string>();
    for (const g of guests) {
      if (g.tableName && g.tableName.trim()) set.add(g.tableName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [guests]);

  const tableGroups = useMemo(() => {
    const map = new Map<string, { table: string; guests: GuestRow[]; totalConfirmed: number; totalPending: number }>();
    map.set('__none__', { table: 'Sem mesa atribuída', guests: [], totalConfirmed: 0, totalPending: 0 });

    for (const t of existingTables) {
      map.set(t, { table: t, guests: [], totalConfirmed: 0, totalPending: 0 });
    }

    for (const g of guests) {
      const key = g.tableName && g.tableName.trim() ? g.tableName.trim() : '__none__';
      if (!map.has(key)) {
        map.set(key, { table: key, guests: [], totalConfirmed: 0, totalPending: 0 });
      }
      const entry = map.get(key)!;
      entry.guests.push(g);
      if (g.attending === true) entry.totalConfirmed += g.partySize;
      else if (g.attending === null) entry.totalPending += g.partySize;
    }

    return Array.from(map.values()).filter(group => group.table !== 'Sem mesa atribuída' || group.guests.length > 0);
  }, [guests, existingTables]);

  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return guests.filter(g => {
      if (term && !g.name.toLowerCase().includes(term) && !(g.phone ?? '').includes(term)) return false;
      if (statusFilter === 'confirmed') return g.attending === true;
      if (statusFilter === 'declined') return g.attending === false;
      if (statusFilter === 'pending') return g.attending === null;
      return true;
    });
  }, [guests, search, statusFilter]);

  /* ---------------------------------------------------------------- AUTENTICAÇÃO */
  if (screen !== 'dashboard') {
    return (
      <div className="admin-auth">
        <img src={botanicals} alt="" className="admin-auth-botanical admin-auth-botanical-left" width={1024} height={1536} />
        <img src={botanicals} alt="" className="admin-auth-botanical admin-auth-botanical-right" width={1024} height={1536} />

        <main className="admin-auth-card">
          <span className="admin-seal" aria-hidden="true">JH</span>
          <h1 className="admin-auth-title">Área dos Noivos</h1>
          <p className="admin-auth-subtitle">Júnior &amp; Hermenegilda · 12 de dezembro de 2026</p>

          {screen === 'checking' && (
            <p className="admin-auth-status" role="status">
              <LoaderCircle className="animate-spin" size={16} /> A verificar o acesso…
            </p>
          )}

          {screen === 'setup' && (
            <form onSubmit={handleSetup} className="admin-form" noValidate>
              <p className="admin-auth-lead">
                Primeiro acesso. Introduz o código de configuração que aparece no Supabase depois de executar o
                schema e cria a vossa palavra-passe.
              </p>
              <div className="admin-field">
                <label htmlFor="setup-code" className="admin-label">Código de configuração</label>
                <input
                  id="setup-code"
                  className="admin-input admin-input-code"
                  value={setupCode}
                  onChange={e => setSetupCode(e.target.value.toUpperCase())}
                  autoComplete="one-time-code"
                  maxLength={40}
                  autoFocus
                  required
                />
              </div>
              <PasswordField
                id="new-password"
                label="Nova palavra-passe"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint="Pelo menos 10 caracteres, com letras e números."
              />
              <PasswordField
                id="confirm-password"
                label="Repetir palavra-passe"
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                autoComplete="new-password"
              />
              {error && <p className="admin-error" role="alert">{error}</p>}
              <Button type="submit" className="wedding-cta admin-submit" disabled={loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
                Criar palavra-passe e entrar
              </Button>
            </form>
          )}

          {screen === 'login' && (
            <form onSubmit={handleLogin} className="admin-form" noValidate>
              <PasswordField
                id="admin-password"
                label="Palavra-passe"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                autoFocus
              />
              {error && <p className="admin-error" role="alert">{error}</p>}
              <Button type="submit" className="wedding-cta admin-submit" disabled={loading || !password}>
                {loading ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
                Entrar
              </Button>
            </form>
          )}

          <p className="admin-auth-foot">
            Acesso reservado aos noivos. Após 5 tentativas falhadas, a entrada fica bloqueada durante 15 minutos.
          </p>
          <a href="/" className="admin-auth-back">Voltar ao convite</a>
        </main>
      </div>
    );
  }

  /* ---------------------------------------------------------------- PAINEL */
  const responded = stats ? stats.confirmedInvites + stats.declinedInvites : 0;
  const pct = (n: number) => (stats && stats.totalInvites ? `${(n / stats.totalInvites) * 100}%` : '0%');

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <a href="/" className="monogram admin-monogram" aria-label="Ver o convite">J<span>&amp;</span>H</a>
        <div className="admin-topbar-title">
          <h1>Painel dos Noivos</h1>
          <p>Casamento de Júnior &amp; Hermenegilda · 12.12.2026</p>
        </div>
        <div className="admin-topbar-actions">
          <Button variant="outline" size="sm" onClick={() => loadDashboard(session)} disabled={loading} aria-label="Atualizar lista">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            <span className="admin-hide-sm">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowPasswordPanel(v => !v); setPwMessage(''); }}
            aria-expanded={showPasswordPanel}
            aria-label="Alterar palavra-passe"
          >
            <KeyRound />
            <span className="admin-hide-sm">Palavra-passe</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} aria-label="Sair">
            <LogOut />
            <span className="admin-hide-sm">Sair</span>
          </Button>
        </div>
      </header>

      <main className="admin-main">
        {showPasswordPanel && (
          <section className="admin-panel admin-password-panel" aria-labelledby="pw-title">
            <div className="admin-panel-head">
              <h2 id="pw-title" className="admin-section-title">Alterar palavra-passe</h2>
              <button type="button" className="admin-icon-btn" onClick={() => setShowPasswordPanel(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="admin-password-form" noValidate>
              <PasswordField id="current-pw" label="Palavra-passe atual" value={currentPw} onChange={setCurrentPw} autoComplete="current-password" />
              <PasswordField
                id="next-pw"
                label="Nova palavra-passe"
                value={newPw}
                onChange={setNewPw}
                autoComplete="new-password"
                hint="Pelo menos 10 caracteres, com letras e números."
              />
              <Button type="submit" className="wedding-cta" disabled={loading || !currentPw || !newPw}>
                Guardar nova palavra-passe
              </Button>
            </form>
            {pwMessage && <p className="admin-error" role="alert">{pwMessage}</p>}
          </section>
        )}

        {notice && (
          <div className="admin-notice" role="status">
            <span>{notice}</span>
            <button type="button" className="admin-icon-btn" onClick={() => setNotice('')} aria-label="Fechar aviso">
              <X size={14} />
            </button>
          </div>
        )}

        {stats && (
          <section className="admin-summary" aria-label="Resumo das confirmações">
            <div className="admin-summary-cells">
              <div className="admin-summary-cell">
                <span className="admin-summary-label"><Users size={14} /> Convites emitidos</span>
                <span className="admin-summary-value">{stats.totalInvites}</span>
                <span className="admin-summary-sub">{stats.totalGuestsTarget} lugares previstos</span>
              </div>
              <div className="admin-summary-cell is-confirmed">
                <span className="admin-summary-label"><CheckCircle2 size={14} /> Confirmados</span>
                <span className="admin-summary-value">{stats.confirmedInvites}</span>
                <span className="admin-summary-sub">{stats.confirmedGuests} pessoas no copo-d’água</span>
              </div>
              <div className="admin-summary-cell is-pending">
                <span className="admin-summary-label"><Clock size={14} /> Aguardam resposta</span>
                <span className="admin-summary-value">{stats.pendingInvites}</span>
                <span className="admin-summary-sub">{stats.pendingGuests} lugares por confirmar</span>
              </div>
              <div className="admin-summary-cell is-declined">
                <span className="admin-summary-label"><XCircle size={14} /> Não podem ir</span>
                <span className="admin-summary-value">{stats.declinedInvites}</span>
                <span className="admin-summary-sub">responderam que não</span>
              </div>
            </div>
            {stats.totalInvites > 0 && (
              <div className="admin-progress">
                <div className="admin-progress-bar" aria-hidden="true">
                  <span className="seg-confirmed" style={{ width: pct(stats.confirmedInvites) }} />
                  <span className="seg-declined" style={{ width: pct(stats.declinedInvites) }} />
                </div>
                <p className="admin-progress-label">
                  {responded} de {stats.totalInvites} convidados já responderam
                </p>
              </div>
            )}
          </section>
        )}

        <div className="admin-tabs" role="tablist" aria-label="Secções do painel">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guests'}
            className="admin-tab"
            onClick={() => setActiveTab('guests')}
          >
            <Users size={16} /> Convidados <span className="admin-tab-count">{guests.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tables'}
            className="admin-tab"
            onClick={() => setActiveTab('tables')}
          >
            <UtensilsCrossed size={16} /> Mesas <span className="admin-tab-count">{existingTables.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            className="admin-tab"
            onClick={() => setActiveTab('create')}
          >
            <Plus size={16} /> Emitir convites
          </button>
          <Button variant="outline" size="sm" className="admin-tabs-action" onClick={downloadCsv} disabled={guests.length === 0}>
            <Download /> <span className="admin-hide-sm">Exportar</span> CSV
          </Button>
        </div>

        {activeTab === 'guests' && (
          <section className="admin-panel" aria-label="Lista de convidados">
            <div className="admin-filter-bar">
              <label className="admin-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Pesquisar por nome ou telemóvel"
                  aria-label="Pesquisar convidados"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              <div className="admin-segmented" role="group" aria-label="Filtrar por estado">
                {([
                  ['all', 'Todos', guests.length],
                  ['confirmed', 'Confirmados', stats?.confirmedInvites ?? 0],
                  ['pending', 'Pendentes', stats?.pendingInvites ?? 0],
                  ['declined', 'Não vão', stats?.declinedInvites ?? 0],
                ] as const).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label} <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {filteredGuests.length === 0 ? (
              <div className="admin-empty">
                <Users size={28} aria-hidden="true" />
                <p className="admin-empty-title">
                  {guests.length === 0 ? 'Ainda não há convidados.' : 'Nenhum convidado corresponde à pesquisa.'}
                </p>
                <p className="admin-empty-text">
                  {guests.length === 0
                    ? 'Emitam os primeiros convites ou aguardem as confirmações feitas pelo link geral.'
                    : 'Experimenta outro nome ou limpa o filtro.'}
                </p>
                {guests.length === 0 && (
                  <Button className="wedding-cta" onClick={() => setActiveTab('create')}>
                    <Plus /> Emitir convites
                  </Button>
                )}
              </div>
            ) : (
              <ul className="admin-guest-list">
                {filteredGuests.map(g => (
                  <li key={g.id} className="admin-guest-row">
                    <div className="admin-guest-info">
                      <div className="admin-guest-line">
                        <span className="admin-guest-name">{g.name}</span>
                        <span className="admin-chip">{g.partySize} {g.partySize === 1 ? 'pessoa' : 'pessoas'}</span>
                        {g.tableName && (
                          <button
                            type="button"
                            onClick={() => openTableModal(g)}
                            className="admin-table-chip transition-all hover:scale-105 cursor-pointer"
                            title="Clique para alterar a mesa"
                          >
                            <UtensilsCrossed size={11} /> {g.tableName}
                          </button>
                        )}
                        {g.attending === true && <span className="admin-status is-confirmed"><CheckCircle2 size={12} /> Confirmado</span>}
                        {g.attending === false && <span className="admin-status is-declined"><XCircle size={12} /> Não vai</span>}
                        {g.attending === null && <span className="admin-status is-pending"><Clock size={12} /> Aguarda resposta</span>}
                      </div>
                      <div className="admin-guest-meta">
                        <span className={g.phone ? '' : 'is-muted'}>
                          <Phone size={12} aria-hidden="true" /> {g.phone || 'Sem telemóvel'}
                        </span>
                        {g.respondedAt && <span>Respondeu a {new Date(g.respondedAt).toLocaleDateString('pt-AO')}</span>}
                      </div>
                      {g.message && <p className="admin-guest-message">“{g.message}”</p>}
                    </div>

                    <div className="admin-guest-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTableModal(g)}
                        className="h-8 text-xs gap-1.5"
                        title="Atribuir ou alterar mesa"
                      >
                        <UtensilsCrossed size={13} className="text-primary" />
                        <span>{g.tableName ? g.tableName : 'Mesa'}</span>
                      </Button>

                      <a href={whatsAppUrl(g)} target="_blank" rel="noreferrer" className="admin-whatsapp">
                        <MessageCircle size={15} /> WhatsApp
                      </a>
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink(g.token)}>
                        {copiedToken === g.token ? <Check /> : <Copy />}
                        {copiedToken === g.token ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <a
                        href={`/convite/${g.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-icon-btn"
                        aria-label={`Abrir o convite de ${g.name}`}
                        title="Abrir convite geral"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <a
                        href={`/passe/${g.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-icon-btn text-primary"
                        aria-label={`Abrir passe de portaria de ${g.name}`}
                        title="Ver passe do porteiro"
                      >
                        <ShieldCheck size={15} />
                      </a>
                      <select
                        className="admin-status-select"
                        aria-label={`Estado de ${g.name}`}
                        value={g.attending === true ? 'yes' : g.attending === false ? 'no' : 'pending'}
                        onChange={e => handleSetStatus(g, e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
                      >
                        <option value="pending">Aguarda</option>
                        <option value="yes">Confirmado</option>
                        <option value="no">Não vai</option>
                      </select>
                      <button
                        type="button"
                        className="admin-icon-btn is-danger"
                        onClick={() => handleDelete(g)}
                        aria-label={`Apagar o convite de ${g.name}`}
                        title="Apagar convite"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'tables' && (
          <section className="admin-panel admin-tables-view" aria-label="Gestão e Organização das Mesas">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-border pb-4">
              <div>
                <h2 className="admin-section-title flex items-center gap-2">
                  <UtensilsCrossed size={20} className="text-primary" /> Organização das Mesas do Copo-d'água
                </h2>
                <p className="admin-hint mt-1">
                  Distribui os teus convidados por mesas. O porteiro verá a mesa de cada um ao escanear o QR Code à entrada!
                </p>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <input
                  className="admin-input"
                  style={{ maxWidth: 220 }}
                  placeholder="Nome/Número (ex: Mesa 1, Família)"
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                />
                <Button
                  size="sm"
                  className="wedding-cta"
                  disabled={!newTableName.trim()}
                  onClick={() => {
                    const trimmed = newTableName.trim();
                    if (!existingTables.includes(trimmed)) {
                      setNotice(`Mesa "${trimmed}" pronta! Agora podes selecioná-la nos convidados.`);
                      setNewTableName('');
                    }
                  }}
                >
                  <Plus /> Criar Mesa
                </Button>
              </div>
            </div>

            {tableGroups.length === 0 ? (
              <div className="admin-empty">
                <UtensilsCrossed size={28} aria-hidden="true" />
                <p className="admin-empty-title">Ainda não há mesas configuradas.</p>
                <p className="admin-empty-text">Cria a tua primeira mesa acima ou atribui uma mesa aos convidados na aba Convidados.</p>
              </div>
            ) : (
              <div className="admin-tables-grid">
                {tableGroups.map(group => (
                  <div key={group.table} className="admin-table-card">
                    <div className="admin-table-card-head">
                      <div>
                        <h3 className="admin-table-card-title">
                          <UtensilsCrossed size={16} /> {group.table}
                        </h3>
                        <p className="admin-table-card-sub">
                          {group.totalConfirmed} confirmados • {group.guests.length} convite(s)
                        </p>
                      </div>
                    </div>

                    <ul className="admin-table-guest-list">
                      {group.guests.map(g => (
                        <li key={g.id} className="admin-table-guest-item">
                          <div>
                            <span className="admin-table-guest-name">{g.name}</span>
                            <span className="admin-table-guest-seats block">
                              {g.partySize} {g.partySize === 1 ? 'pessoa' : 'pessoas'}
                              {g.attending === true && ' • Confirmado'}
                              {g.attending === null && ' • Pendente'}
                              {g.attending === false && ' • Recusado'}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTableModal(g)}
                            className="h-7 text-xs gap-1"
                            title="Mudar mesa"
                          >
                            <UtensilsCrossed size={11} className="text-primary" />
                            <span>{g.tableName || 'Mudar'}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'create' && (
          <section className="admin-create" aria-labelledby="create-title">
            <div className="admin-create-intro">
              <h2 id="create-title" className="admin-section-title">Emitir convites personalizados</h2>
              <p>
                Cada convidado recebe um link único com o nome em “Têm a honra de Convidar”. Quem confirmou pelo link
                geral já aparece na lista; usem o mesmo telemóvel para não duplicar o convite.
              </p>
            </div>

            <div className="admin-create-grid">
              <form id="bulk-form" className="admin-panel admin-create-box" onSubmit={handleCreateGuests}>
                <h3 className="admin-box-title">Colar uma lista</h3>
                <p className="admin-hint">Um convidado por linha: nome, telemóvel, número de pessoas.</p>
                <pre className="admin-example">{'Família Silva, +244923111222, 2\nJorge & Marta, +244924333444, 2\nTio António, +244935555666, 1'}</pre>
                <label htmlFor="bulk-text" className="sr-only">Lista de convidados</label>
                <textarea
                  id="bulk-text"
                  className="admin-input admin-textarea"
                  rows={8}
                  placeholder="Cola aqui a lista de nomes…"
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                />
                <Button type="submit" className="wedding-cta admin-submit" disabled={loading || !bulkText.trim()}>
                  {loading ? <LoaderCircle className="animate-spin" /> : <Send />}
                  Gerar convites da lista
                </Button>
              </form>

              <form id="single-form" className="admin-panel admin-create-box" onSubmit={handleCreateGuests}>
                <h3 className="admin-box-title">Um convidado</h3>
                <p className="admin-hint">Para uma pessoa ou um casal em particular.</p>
                <div className="admin-field">
                  <label htmlFor="single-name" className="admin-label">Nome no convite</label>
                  <input
                    id="single-name"
                    className="admin-input"
                    placeholder="Pedro & Maria"
                    value={singleName}
                    maxLength={120}
                    onChange={e => {
                      setSingleName(e.target.value);
                      if (/\s(&|e)\s/i.test(e.target.value)) setSinglePartySize(2);
                    }}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="single-phone" className="admin-label">Telemóvel / WhatsApp (opcional)</label>
                  <input
                    id="single-phone"
                    type="tel"
                    className="admin-input"
                    placeholder="+244 9XX XXX XXX"
                    value={singlePhone}
                    maxLength={25}
                    onChange={e => setSinglePhone(e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="single-size" className="admin-label">Lugares</label>
                  <select
                    id="single-size"
                    className="admin-input"
                    value={singlePartySize}
                    onChange={e => setSinglePartySize(Number(e.target.value))}
                  >
                    <option value={1}>1 pessoa</option>
                    <option value={2}>2 pessoas (com acompanhante)</option>
                  </select>
                </div>
                <Button type="submit" className="wedding-cta admin-submit" disabled={loading || !singleName.trim()}>
                  {loading ? <LoaderCircle className="animate-spin" /> : <Plus />}
                  Gerar convite
                </Button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* DIALOG SHADCN: ATRIBUIR / EDITAR MESA */}
      <Dialog
        open={!!tableModalGuest}
        onOpenChange={open => {
          if (!open) setTableModalGuest(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-white border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif text-primary">
              <UtensilsCrossed size={20} /> Atribuir Mesa
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {tableModalGuest && (
                <span>
                  Define a mesa para <strong>{tableModalGuest.name}</strong> ({tableModalGuest.partySize}{' '}
                  {tableModalGuest.partySize === 1 ? 'lugar' : 'lugares'}).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label
                htmlFor="table-name-modal"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
              >
                Nome ou Número da Mesa
              </label>
              <input
                id="table-name-modal"
                className="admin-input w-full"
                placeholder="Ex.: Mesa 1, Mesa VIP, Família..."
                value={tableModalValue}
                onChange={e => setTableModalValue(e.target.value)}
                autoFocus
              />
            </div>

            {existingTables.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground block font-medium">
                  Ou clica numa mesa já existente:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-border/60 rounded-md bg-secondary/30">
                  {existingTables.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTableModalValue(t)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                        tableModalValue.trim().toLowerCase() === t.trim().toLowerCase()
                          ? 'bg-primary text-white border-primary font-medium shadow-sm'
                          : 'bg-white hover:bg-secondary border-border text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between items-center gap-2 pt-3 border-t border-border">
            {tableModalGuest?.tableName ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  if (tableModalGuest) {
                    await handleSetTable(tableModalGuest, '');
                    setTableModalGuest(null);
                  }
                }}
              >
                Remover Mesa
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTableModalGuest(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="wedding-cta"
                onClick={saveTableModal}
              >
                Guardar Mesa
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
