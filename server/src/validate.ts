import { ApiError } from './kernel.ts';

export const bad = (m: string) => new ApiError(400, 'invalid_request', m);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function str(v: unknown, field: string, min = 1, max = 200): string {
  if (typeof v !== 'string') throw bad(`${field} is required`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${field} must be ${min}-${max} characters`);
  return s;
}
export const email = (v: unknown) => {
  const e = str(v, 'email', 3, 320).toLowerCase();
  if (!EMAIL.test(e)) throw bad('email is not valid');
  return e;
};
export const password = (v: unknown) => str(v, 'password', 10, 200);
export const uuid = (v: unknown, field: string) => {
  const s = str(v, field, 36, 36);
  if (!/^[0-9a-f-]{36}$/i.test(s)) throw bad(`${field} is not valid`);
  return s;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const todayIn = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
export const shiftDay = (day: string, delta: number) => new Date(Date.parse(day + 'T00:00:00Z') + delta * 86_400_000).toISOString().slice(0, 10);
export function dayOrToday(v: unknown, tz: string): string {
  const today = todayIn(tz);
  const d = typeof v === 'string' && v ? v : today;
  if (!ISO_DAY.test(d) || Number.isNaN(Date.parse(d))) throw bad('day must be YYYY-MM-DD');
  if (d > today) throw bad('Attendance cannot be recorded for a future day');
  return d;
}

/** Money is always integer minor units. */
export function minor(v: unknown, field = 'amountMinor'): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > 1_000_000_000_000) throw bad(`${field} must be a whole number of minor units (for example paise or cents) above zero`);
  return v;
}
export function currency(v: unknown): string {
  const c = str(v, 'currency', 3, 3).toUpperCase();
  try { new Intl.NumberFormat('en', { style: 'currency', currency: c }); } catch { throw bad('currency must be an ISO 4217 code such as INR, USD or JPY'); }
  return c;
}
export function isoDay(v: unknown, field: string): string {
  const s = str(v, field, 10, 10);
  if (!ISO_DAY.test(s) || Number.isNaN(Date.parse(s))) throw bad(`${field} must be YYYY-MM-DD`);
  return s;
}
