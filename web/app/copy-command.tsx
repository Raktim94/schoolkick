'use client';
import { useEffect, useRef, useState } from 'react';

/** Clipboard write that always settles: the async API can stay pending (blocked permission or unfocused frame), so time it out and fall back to execCommand. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      const ok = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true, () => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200)),
      ]);
      if (ok) return true;
    }
  } catch { /* fall through */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

/** A shell command with a Copy button. The text shown and the text copied are the same string. */
export default function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try { if (!(await writeClipboard(command))) throw new Error('copy failed'); setState('copied'); timer.current = setTimeout(() => setState('idle'), 2000); }
    catch { setState('error'); }
  }
  return <div className="install-command copyable">
    <pre tabIndex={0} aria-label={label ?? 'Command'}><code>{command}</code></pre>
    <button type="button" className="copy-btn" onClick={copy} aria-label={state === 'copied' ? 'Copied to clipboard' : `Copy: ${label ?? 'command'}`}>{state === 'copied' ? 'Copied' : 'Copy'}</button>
    <span role="status" className={state === 'error' ? 'copy-error' : 'sr-only'}>{state === 'error' ? 'Copy is unavailable here. Select the command and copy it manually.' : state === 'copied' ? 'Command copied to clipboard.' : ''}</span>
  </div>;
}
