// Public-site behaviour. Loaded in <head> so the "js" class lands before first paint; the rest waits for the DOM.
document.documentElement.classList.add('js');
document.addEventListener('DOMContentLoaded', () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Copy buttons (install tabs and code blocks).
  document.querySelectorAll('.copy').forEach((b) => {
    const src = b.closest('.term, .codewrap')?.querySelector('code');
    if (!src || !navigator.clipboard) { b.hidden = true; return; }
    b.addEventListener('click', async () => {
      const text = [...src.querySelectorAll('.line')].length
        ? [...src.querySelectorAll('.line:not(.c)')].map((l) => l.textContent.replace(/^\$ /, '')).join('\n')
        : src.textContent;
      try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; b.classList.add('done'); } catch { b.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1800);
    });
  });

  // Install tabs: arrow keys move between tabs, the visitor's system is preselected.
  document.querySelectorAll('[role=tablist]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role=tab]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    const show = (i, focus) => {
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(i));
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); show((i + k + tabs.length) % tabs.length, true); }
        if (e.key === 'Home') { e.preventDefault(); show(0, true); }
        if (e.key === 'End') { e.preventDefault(); show(tabs.length - 1, true); }
      });
    });
    const ua = navigator.userAgent;
    const want = /Mac OS X|Macintosh/.test(ua) && !/Mobile/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : 'deb';
    const i = Math.max(0, tabs.findIndex((t) => t.dataset.os === want));
    show(i);
  });

  // Scroll-driven reveals. Everything is visible without scripting or with reduced motion.
  const targets = [...document.querySelectorAll('.rv, .register, .history, .layers')];
  const fire = (el) => el.classList.add('in', 'go');
  document.querySelectorAll('.feature-list').forEach((list) => list.querySelectorAll('li').forEach((row, i) => row.style.setProperty('--feature-index', String(i))));
  document.querySelectorAll('.register').forEach((r) => r.querySelectorAll('tbody tr').forEach((tr, ri) => [...tr.children].forEach((td, ci) => td.style.setProperty('--i', String(ri * 2 + ci)))));
  if (reduce || !('IntersectionObserver' in window)) { targets.forEach(fire); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { fire(e.target); io.unobserve(e.target); } }), { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
  targets.forEach((t) => io.observe(t));
});
