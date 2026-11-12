'use client';
import { useEffect, useRef, useState } from 'react';

/** A shell command with a Copy button. The text shown and the text copied are the same string. */
export default function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(command); setState('copied'); timer.current = setTimeout(() => setState('idle'), 2000); }
    catch { setState('error'); }
  }
  return <div className="install-command copyable">
    <pre tabIndex={0} aria-label={label ?? 'Command'}><code>{command}</code></pre>
    <button type="button" className="copy-btn" onClick={copy} aria-label={state === 'copied' ? 'Copied to clipboard' : `Copy: ${label ?? 'command'}`}>{state === 'copied' ? 'Copied' : 'Copy'}</button>
    <span role="status" className={state === 'error' ? 'copy-error' : 'sr-only'}>{state === 'error' ? 'Copy is unavailable here. Select the command and copy it manually.' : state === 'copied' ? 'Command copied to clipboard.' : ''}</span>
  </div>;
}
