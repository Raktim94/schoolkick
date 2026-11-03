import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Db } from './db.ts';

const require = createRequire(import.meta.url);
const font = (pkg: string, f: string) => require.resolve(`@fontsource/${pkg}/files/${f}`);
const F = {
  latin: font('noto-sans', 'noto-sans-latin-400-normal.woff'), latinB: font('noto-sans', 'noto-sans-latin-700-normal.woff'),
  deva: font('noto-sans-devanagari', 'noto-sans-devanagari-devanagari-400-normal.woff'), devaB: font('noto-sans-devanagari', 'noto-sans-devanagari-devanagari-700-normal.woff'),
};
const isDeva = (ch: string) => /[ऀ-ॿ᳐-᳿꣠-ꣿ₹]/.test(ch);

let secret: Promise<string> | undefined;
/** Signing key for verification links, created once and kept in the database (not readable by tenant requests). */
export function signingKey(db: Db): Promise<string> {
  return (secret ??= (async () => {
    await db.query(`insert into app_secrets (name, value) values ('receipt_signing', $1) on conflict do nothing`, [randomBytes(32).toString('hex')]);
    return (await db.query(`select value from app_secrets where name = 'receipt_signing'`)).rows[0].value as string;
  })());
}
export const signReceipt = (key: string, id: string) => createHmac('sha256', key).update('receipt:' + id).digest('base64url').slice(0, 22);
export const checkReceiptSig = (key: string, id: string, sig: string) => {
  const want = signReceipt(key, id);
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
};

export type ReceiptData = {
  number: string; amountMinor: number; currency: string; issuedAt: Date; verifyUrl: string;
  snapshot: Record<string, string | null>; refunds: { amountMinor: number; reason: string; at: Date }[];
};
const money = (m: number, cur: string) => new Intl.NumberFormat('en', { style: 'currency', currency: cur, currencyDisplay: 'code' }).format(m / 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2));

/** One-page A4 receipt. Latin and Devanagari text render; other scripts print as blanks (documented limit). */
export async function receiptPdf(r: ReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Receipt ${r.number}`, Author: r.snapshot.institution ?? 'SchoolKick' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
  const write = (text: string, o: { bold?: boolean; size?: number; x?: number; y?: number; width?: number; color?: string; align?: 'left' | 'right' } = {}) => {
    doc.fontSize(o.size ?? 11).fillColor(o.color ?? '#17212f');
    const runs: { t: string; d: boolean }[] = [];
    for (const ch of text) { const d = isDeva(ch); if (runs.length && runs[runs.length - 1].d === d) runs[runs.length - 1].t += ch; else runs.push({ t: ch, d }); }
    if (!runs.length) runs.push({ t: '', d: false });
    if (o.x !== undefined) doc.x = o.x; if (o.y !== undefined) doc.y = o.y;
    runs.forEach((run, i) => {
      doc.font(run.d ? (o.bold ? F.devaB : F.deva) : o.bold ? F.latinB : F.latin);
      doc.text(run.t, { continued: i < runs.length - 1, width: o.width, align: o.align });
    });
  };
  write(r.snapshot.institution ?? '', { bold: true, size: 18 });
  write('Payment receipt', { color: '#536174' });
  doc.moveDown(0.8);
  const rows: [string, string][] = [
    ['Receipt number', r.number], ['Date and time', r.issuedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'], ['Learner', r.snapshot.learner ?? ''],
    ...(r.snapshot.payer ? [['Paid by', r.snapshot.payer] as [string, string]] : []),
    ['For', `${r.snapshot.description} (${r.snapshot.invoice})`], ['Method', (r.snapshot.method ?? '').replace('_', ' ')],
    ...(r.snapshot.utr ? [['UPI transaction id', r.snapshot.utr] as [string, string]] : []),
    ...(r.snapshot.reference ? [['Office reference', r.snapshot.reference] as [string, string]] : []),
    ...(r.snapshot.providerRef ? [['Transaction reference', r.snapshot.providerRef] as [string, string]] : []),
  ];
  for (const [k, v] of rows) { const y = doc.y; write(k, { size: 9, color: '#536174', x: 56, y, width: 150 }); write(v, { x: 210, y, width: 320 }); doc.moveDown(0.4); }
  doc.moveDown(0.6);
  write(`${money(r.amountMinor, r.currency)} paid`, { bold: true, size: 20, x: 56 });
  if (r.refunds.length) {
    doc.moveDown(0.6); write('Refunds recorded', { bold: true, x: 56 });
    for (const f of r.refunds) write(`${f.at.toISOString().slice(0, 10)}  ${f.reason}  -${money(f.amountMinor, r.currency)}`, { size: 10, x: 56 });
    write(`Net paid: ${money(r.amountMinor - r.refunds.reduce((s, f) => s + f.amountMinor, 0), r.currency)}`, { size: 10, x: 56 });
  }
  const qr = await QRCode.toBuffer(r.verifyUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
  const y = 640;
  doc.image(qr, 56, y, { width: 90 });
  write('Scan to check this receipt is genuine.', { size: 9, color: '#536174', x: 156, y: y + 8, width: 340 });
  write(r.verifyUrl, { size: 8, color: '#536174', x: 156, y: y + 34, width: 340 });
  write('This receipt is not changed by a later refund; refunds are listed above.', { size: 8, color: '#536174', x: 156, y: y + 62, width: 340 });
  doc.end();
  return done;
}
