document.querySelectorAll('.codewrap').forEach((w) => {
  const b = w.querySelector('.copy'); const c = w.querySelector('code');
  if (!b || !c || !navigator.clipboard) { if (b) b.hidden = true; return; }
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(c.textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Press Ctrl+C'; }
    setTimeout(() => (b.textContent = 'Copy'), 1800);
  });
});
