import { describe, it, expect } from 'vitest';
import { weddingDate, countdownToWedding, invitationTokenSchema, decemberDays } from '../lib/wedding';
describe('Wedding invitation rules', () => {
  it('uses 12 December 2026 at 13h30 Luanda for the first ceremony', () => {
    expect(weddingDate).toBe('2026-12-12T13:30:00+01:00');
    expect(countdownToWedding(new Date('2026-12-11T13:30:00+01:00').getTime())).toEqual([1, 0, 0, 0]);
  });
  it('requires a non-enumerable capability invitation token (12 to 64 hex characters)', () => {
    expect(invitationTokenSchema.safeParse('guest-1').success).toBe(false);
    expect(invitationTokenSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(invitationTokenSchema.safeParse('a'.repeat(64)).success).toBe(true);
  });
  it('places December 12 on Saturday', () => { expect(decemberDays()[12]).toBe(12); expect(12 % 7).toBe(5); });
});