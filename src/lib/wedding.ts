import { z } from 'zod';

export const invitationTokenSchema = z.string().trim().regex(/^[a-f0-9]{12,64}$/, 'Código de convite inválido.');
export const weddingDate = '2026-12-12T13:30:00+01:00';
export const receptionUrl = 'https://share.google/ifuXTj0rOMv3ccsZW';
export const rsvpUrl = 'https://forms.cloud.microsoft/r/s3yb66XwGu';
export const churchUrl = 'https://www.google.com/maps/search/?api=1&query=Sal%C3%A3o%20do%20Reino%20Testemunhas%20de%20Jeov%C3%A1%20Sonho%20da%20Casa%20Pr%C3%B3pria%20Col%C3%A9gio%20dos%20Marotos%20Luanda';
export const weddingPhones = ['+244 932 946 648', '+244 924 848 866'];
export function countdownToWedding(now: number) {
  const seconds = Math.max(0, Math.floor((new Date(weddingDate).getTime() - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}
export function decemberDays() {
  return [...Array.from({ length: 1 }, () => null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
}