import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { setResponseHeader } from '@tanstack/react-start/server';
import { invitationTokenSchema } from './wedding';

/**
 * Cliente Supabase do servidor. Usa a chave publicável: o acesso às tabelas está
 * bloqueado por RLS e toda a lógica passa por funções SECURITY DEFINER no schema.
 */
function getSupabaseServerClient() {
  const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
  if (!url || !key) {
    throw new Error('A base de dados do casamento está temporariamente indisponível.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) {
          headers.delete('Authorization');
        }
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function noStore() {
  setResponseHeader('Cache-Control', 'private, no-store');
}

/** Converte erros da base de dados em mensagens claras, sem expor detalhes internos. */
function dbError(error: { message?: string; code?: string; details?: string } | null, fallback: string): Error {
  const msg = error?.message ?? '';
  if (error) {
    console.error('[Supabase RPC Error]', error);
  }
  if (error?.code === '28000' || /Sessão expirada/i.test(msg)) {
    return new Error('Sessão expirada. Entra novamente na Área dos Noivos.');
  }
  if (/function .* does not exist|Could not find the function/i.test(msg)) {
    return new Error('A base de dados ainda não foi atualizada. Executa o ficheiro supabase/schema.sql no Supabase.');
  }
  // Mensagens levantadas pelas nossas funções (RAISE EXCEPTION) já estão em português.
  if (error?.code === 'P0001' && msg) return new Error(msg);
  if (msg && !/password|secret|hash/i.test(msg)) return new Error(msg);
  return new Error(fallback);
}

/* ==============================================================================
 * CONVIDADOS (PÚBLICO)
 * ============================================================================== */

export interface GuestDetails {
  name: string;
  attending?: boolean | null;
  partySize?: number;
  respondedAt?: string | null;
  tableName?: string | null;
  checkedInAt?: string | null;
}

export const lookupInvitation = createServerFn({ method: 'POST' })
  .validator((data: unknown) => invitationTokenSchema.parse(data))
  .handler(async ({ data: token }): Promise<GuestDetails | null> => {
    noStore();
    const { data, error } = await getSupabaseServerClient().rpc('lookup_wedding_invitation', { invitation_token: token });
    if (error) throw dbError(error, 'Não foi possível consultar o convite. Tenta novamente mais tarde.');
    const guest = (data as Array<{
      name: string;
      attending: boolean | null;
      party_size: number;
      responded_at: string | null;
      table_name?: string | null;
      checked_in_at?: string | null;
    }> | null)?.[0];
    return guest
      ? {
          name: guest.name,
          attending: guest.attending ?? null,
          partySize: guest.party_size ?? 1,
          respondedAt: guest.responded_at ?? null,
          tableName: guest.table_name ?? null,
          checkedInAt: guest.checked_in_at ?? null,
        }
      : null;
  });

export interface CheckInResult {
  success: boolean;
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  guestName: string;
}

export const checkInGuest = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ token: invitationTokenSchema }).parse(data))
  .handler(async ({ data: { token } }): Promise<CheckInResult> => {
    noStore();
    const { data, error } = await getSupabaseServerClient().rpc('check_in_wedding_guest', {
      invitation_token: token,
    });
    if (error) throw dbError(error, 'Não foi possível registar o check-in na portaria.');
    const row = (data as Array<{
      success: boolean;
      already_checked_in: boolean;
      checked_in_at: string;
      guest_name: string;
    }> | null)?.[0];
    if (!row) throw new Error('Falha ao processar o check-in na portaria.');
    return {
      success: row.success,
      alreadyCheckedIn: row.already_checked_in,
      checkedInAt: row.checked_in_at,
      guestName: row.guest_name,
    };
  });

export const rsvpSchema = z.object({
  name: z.string().trim().min(2, 'Escreve o nome do convite.').max(120),
  phone: z.string().trim().regex(/^\+?[\d\s-]{9,20}$/, 'Número de telemóvel inválido.'),
  attending: z.boolean(),
  guests: z.number().int().min(1).max(2),
  message: z.string().trim().max(500).optional().default(''),
});

export const submitRsvp = createServerFn({ method: 'POST' })
  .validator((data: unknown) => rsvpSchema.parse(data))
  .handler(async ({ data }) => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('submit_wedding_rsvp', {
      guest_name: data.name,
      guest_phone: data.phone,
      is_attending: data.attending,
      guests: data.guests,
      note: data.message,
    });
    if (error) throw dbError(error, 'Não foi possível guardar a confirmação. Tenta novamente.');
    const row = (rows as Array<{ token: string; name: string; attending: boolean }> | null)?.[0];
    if (!row) throw new Error('Este convite foi desativado. Contacta os noivos.');
    return row;
  });

export const personalRsvpSchema = z.object({
  token: invitationTokenSchema,
  attending: z.boolean(),
  partySize: z.number().int().min(1).max(2).default(1),
  message: z.string().trim().max(500).optional().default(''),
});

export const confirmPersonalRsvp = createServerFn({ method: 'POST' })
  .validator((data: unknown) => personalRsvpSchema.parse(data))
  .handler(async ({ data }) => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('confirm_wedding_invitation', {
      invitation_token: data.token,
      is_attending: data.attending,
      guests: data.partySize,
      note: data.message,
    });
    if (error) throw dbError(error, 'Não foi possível registar a tua resposta. Tenta novamente.');
    const row = (rows as Array<{ name: string; attending: boolean; party_size: number }> | null)?.[0];
    if (!row) throw new Error('Convite não encontrado ou desativado.');
    return row;
  });

/* ==============================================================================
 * ÁREA DOS NOIVOS (SESSÃO SEGURA)
 * ============================================================================== */

const sessionSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Sessão inválida.');
const passwordSchema = z
  .string()
  .min(10, 'A palavra-passe precisa de pelo menos 10 caracteres.')
  .max(128)
  .regex(/[A-Za-z]/, 'A palavra-passe precisa de letras.')
  .regex(/[0-9]/, 'A palavra-passe precisa de números.');

export interface GuestRow {
  id: string;
  name: string;
  phone: string | null;
  token: string;
  partySize: number;
  attending: boolean | null;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  active: boolean;
  tableName?: string | null;
  checkedInAt?: string | null;
}

export interface DashboardStats {
  totalInvites: number;
  totalGuestsTarget: number;
  confirmedInvites: number;
  confirmedGuests: number;
  declinedInvites: number;
  pendingInvites: number;
  pendingGuests: number;
  checkedInInvites: number;
  checkedInGuests: number;
}

type AuthResult = { session_token: string | null; error: string | null };

export const adminGetStatus = createServerFn({ method: 'POST' }).handler(async () => {
  noStore();
  const { data, error } = await getSupabaseServerClient().rpc('admin_status');
  if (error) throw dbError(error, 'Não foi possível verificar a Área dos Noivos.');
  return { configured: Boolean((data as Array<{ configured: boolean }> | null)?.[0]?.configured) };
});

export const adminSetupPassword = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({ setupCode: z.string().trim().min(4, 'Introduz o código de configuração.').max(40), password: passwordSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('admin_setup_password', {
      p_setup_code: data.setupCode,
      p_password: data.password,
    });
    if (error) throw dbError(error, 'Não foi possível criar a palavra-passe.');
    const result = (rows as AuthResult[] | null)?.[0];
    if (!result?.session_token) throw new Error(result?.error ?? 'Não foi possível criar a palavra-passe.');
    return { session: result.session_token };
  });

export const adminLogin = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ password: z.string().min(1, 'Introduz a palavra-passe.').max(128) }).parse(data))
  .handler(async ({ data }) => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('admin_login', { p_password: data.password });
    if (error) throw dbError(error, 'Não foi possível entrar. Tenta novamente.');
    const result = (rows as AuthResult[] | null)?.[0];
    if (!result?.session_token) throw new Error(result?.error ?? 'Palavra-passe incorreta.');
    return { session: result.session_token };
  });

export const adminLogout = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ session: sessionSchema }).parse(data))
  .handler(async ({ data }) => {
    noStore();
    await getSupabaseServerClient().rpc('admin_logout', { p_session: data.session });
    return { success: true };
  });

export const adminChangePassword = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({ session: sessionSchema, current: z.string().min(1).max(128), next: passwordSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('admin_change_password', {
      p_session: data.session,
      p_current: data.current,
      p_new: data.next,
    });
    if (error) throw dbError(error, 'Não foi possível alterar a palavra-passe.');
    const message = (rows as Array<{ error: string | null }> | null)?.[0]?.error;
    if (message) throw new Error(message);
    return { success: true };
  });

export const adminGetDashboard = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ session: sessionSchema }).parse(data))
  .handler(async ({ data }): Promise<{ stats: DashboardStats; guests: GuestRow[] }> => {
    noStore();
    const { data: rows, error } = await getSupabaseServerClient().rpc('admin_list_guests', { p_session: data.session });
    if (error) throw dbError(error, 'Não foi possível carregar a lista de convidados.');

    type Raw = {
      id: string; name: string; phone: string | null; token: string; party_size: number | null;
      attending: boolean | null; message: string | null; created_at: string; responded_at: string | null; active: boolean | null;
      table_name?: string | null; checked_in_at?: string | null;
    };
    const guests: GuestRow[] = ((rows as Raw[] | null) ?? []).map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      token: r.token,
      partySize: r.party_size ?? 1,
      attending: r.attending,
      message: r.message,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      active: r.active ?? true,
      tableName: r.table_name ?? null,
      checkedInAt: r.checked_in_at ?? null,
    }));

    const stats: DashboardStats = {
      totalInvites: guests.length,
      totalGuestsTarget: 0,
      confirmedInvites: 0,
      confirmedGuests: 0,
      declinedInvites: 0,
      pendingInvites: 0,
      pendingGuests: 0,
      checkedInInvites: 0,
      checkedInGuests: 0,
    };
    for (const g of guests) {
      stats.totalGuestsTarget += g.partySize;
      if (g.attending === true) { stats.confirmedInvites++; stats.confirmedGuests += g.partySize; }
      else if (g.attending === false) stats.declinedInvites++;
      else { stats.pendingInvites++; stats.pendingGuests += g.partySize; }

      if (g.checkedInAt) {
        stats.checkedInInvites++;
        stats.checkedInGuests += g.partySize;
      }
    }
    return { stats, guests };
  });

export const adminCreateGuests = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({
      session: sessionSchema,
      items: z
        .array(z.object({
          name: z.string().trim().min(2, 'Nome muito curto').max(120),
          phone: z.string().trim().max(25).optional(),
          partySize: z.number().int().min(1).max(2).default(1),
        }))
        .min(1, 'Adiciona pelo menos um convidado.')
        .max(300, 'Emite no máximo 300 convites de cada vez.'),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const client = getSupabaseServerClient();
    const created: Array<{ name: string; token: string; phone: string | null }> = [];
    for (const item of data.items) {
      const { data: rows, error } = await client.rpc('admin_create_guest', {
        p_session: data.session,
        p_name: item.name,
        p_phone: item.phone ?? '',
        p_party_size: item.partySize,
      });
      if (error) throw dbError(error, `Não foi possível emitir o convite de ${item.name}.`);
      const row = (rows as Array<{ name: string; token: string; phone: string | null }> | null)?.[0];
      if (row) created.push(row);
    }
    return { success: true, count: created.length, created };
  });

export const adminDeleteGuest = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ session: sessionSchema, token: invitationTokenSchema }).parse(data))
  .handler(async ({ data }) => {
    noStore();
    const { error } = await getSupabaseServerClient().rpc('admin_delete_guest', { p_session: data.session, p_token: data.token });
    if (error) throw dbError(error, 'Não foi possível apagar o convidado.');
    return { success: true };
  });

export const adminUpdateGuest = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({
      session: sessionSchema,
      token: invitationTokenSchema,
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(25).optional().nullable(),
      partySize: z.number().int().min(1).max(2),
      attending: z.boolean().nullable(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const { error } = await getSupabaseServerClient().rpc('admin_update_guest', {
      p_session: data.session,
      p_token: data.token,
      p_name: data.name,
      p_phone: data.phone ?? '',
      p_party_size: data.partySize,
      p_attending: data.attending,
    });
    if (error) throw dbError(error, 'Não foi possível atualizar o convidado.');
    return { success: true };
  });

export const adminSetGuestTable = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({
      session: sessionSchema,
      token: invitationTokenSchema,
      tableName: z.string().trim().max(100).nullable().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const { error } = await getSupabaseServerClient().rpc('admin_set_guest_table', {
      p_session: data.session,
      p_token: data.token,
      p_table_name: data.tableName || null,
    });
    if (error) throw dbError(error, 'Não foi possível atribuir a mesa ao convidado.');
    return { success: true };
  });

export const adminToggleCheckin = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({
      session: sessionSchema,
      token: invitationTokenSchema,
      checkedIn: z.boolean(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const { error } = await getSupabaseServerClient().rpc('admin_toggle_checkin', {
      p_session: data.session,
      p_token: data.token,
      p_checked_in: data.checkedIn,
    });
    if (error) throw dbError(error, 'Não foi possível atualizar o registo de entrada.');
    return { success: true };
  });

