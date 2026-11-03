import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR drawn in the browser from a link we built; the image is plain black on white so any phone camera reads it. */
export function Qr({ value, label, size = 240 }: { value: string; label: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let off = false; QRCode.toDataURL(value, { margin: 2, width: size * 2, errorCorrectionLevel: 'M' }).then((u) => { if (!off) setSrc(u); }); return () => { off = true; }; }, [value, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={label} /> : <p className="muted" role="status">Preparing QR…</p>;
}
