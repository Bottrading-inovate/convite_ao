import { z } from 'zod';

export const invitationTokenSchema = z.string().trim().regex(/^[a-f0-9]{12,64}$/, 'Código de convite inválido.');

// Data e hora de início oficial do casamento (11:00 em Luanda, UTC+1)
export const weddingDate = '2026-12-12T11:00:00+01:00';

// Domínio público mascarado preferencial (InfinityFree)
export const publicDomain = 'https://nossocasamento.gt.tc';

export const receptionUrl = 'https://share.google/ifuXTj0rOMv3ccsZW';
export const rsvpUrl = 'https://forms.cloud.microsoft/r/s3yb66XwGu';
export const churchUrl = 'https://www.google.com/maps/search/?api=1&query=Sal%C3%A3o%20do%20Reino%20Testemunhas%20de%20Jeov%C3%A1%20Sonho%20da%20Casa%20Pr%C3%B3pria%20Col%C3%A9gio%20dos%20Marotos%20Luanda';
export const weddingPhones = ['+244 932 946 648', '+244 924 848 866'];

/** Dados bancários e métodos de contribuição carinhosa */
export const weddingGifts = {
  groomName: 'Júnior',
  groomIban: '004000003705242910182',
  brideName: 'Hermenegilda',
  brideIban: '000500006994136610197',
  expressNumber: '932946648',
  expressDisplay: '932 946 648',
  whatsappProofPhone: '244932946648',
};

/** Programa Oficial do Casamento atualizado */
export interface ScheduleItem {
  time: string;
  name: string;
  detail: string;
  location: string;
}

export const officialSchedule: ScheduleItem[] = [
  {
    time: '11:00 – 12:30',
    name: 'Cerimónia de Casamento Civil',
    detail: 'Celebração formal da união e assinatura perante a família e amigos',
    location: 'Salão do Reino das Testemunhas de Jeová',
  },
  {
    time: '12:45 – 13:30',
    name: 'Discurso Bíblico de Casamento',
    detail: 'Edificação espiritual com a bênção de Jeová',
    location: 'Salão do Reino das Testemunhas de Jeová',
  },
  {
    time: '13:30 – 14:45',
    name: 'Coffee Break',
    detail: 'Momento de carinho e convívio no Salão do Reino',
    location: 'Salão do Reino das Testemunhas de Jeová',
  },
  {
    time: '19:30',
    name: 'Copo-d’água (A Boda)',
    detail: 'Recepção festiva e jantar comemorativo',
    location: 'Salão de Festas “Detalhe Precioso”',
  },
];

/** Gera a URL do convite garantindo a máscara do domínio */
export function buildInviteUrl(token: string, baseOrigin?: string): string {
  const base = (baseOrigin && !baseOrigin.includes('workers.dev')) ? baseOrigin : publicDomain;
  return `${base.replace(/\/$/, '')}/convite/${token}`;
}

/** Gera a URL do passe de portaria com a máscara do domínio */
export function buildPasseUrl(token: string, baseOrigin?: string): string {
  const base = (baseOrigin && !baseOrigin.includes('workers.dev')) ? baseOrigin : publicDomain;
  return `${base.replace(/\/$/, '')}/passe/${token}`;
}

export function countdownToWedding(now: number) {
  const seconds = Math.max(0, Math.floor((new Date(weddingDate).getTime() - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

export function decemberDays() {
  return [...Array.from({ length: 1 }, () => null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
}