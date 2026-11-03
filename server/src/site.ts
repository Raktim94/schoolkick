import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type SitePage = { path: string; file: string; title: string; description: string; nav: string; menu?: boolean; kind?: 'faq' | 'howto' };
export const PAGES: SitePage[] = [
  { path: '/', file: 'index.html', nav: 'Home', menu: false, title: 'SchoolKick: free open-source school attendance software', description: 'Free, open-source school software you host yourself. Teachers take attendance on a phone, families see today’s status in a browser, and every correction keeps its history.' },
  { path: '/features', file: 'features.html', nav: 'Features', menu: true, title: 'Features: attendance, family view, CSV import | SchoolKick', description: 'Attendance with correction history, a family view that needs no app, a school overview dashboard and a CSV importer that checks every row first.' },
  { path: '/get-started', file: 'get-started.html', nav: 'Get started', menu: true, kind: 'howto', title: 'Install SchoolKick: Docker, Node.js or CasaOS, step by step', description: 'Install the open-source school attendance app in about 15 minutes with Docker Compose or Node.js and PostgreSQL, then create your institution and take your first register.' },
  { path: '/screenshots', file: 'screenshots.html', nav: 'Screenshots', menu: true, title: 'Screenshots of the SchoolKick app on phone and desktop', description: 'Real screenshots of the teacher roster, correction history, family view, school overview and CSV import, in light and dark themes. All names are synthetic.' },
  { path: '/self-hosting', file: 'self-hosting.html', nav: 'Self-hosting', menu: true, title: 'Self-host SchoolKick with Docker or CasaOS', description: 'Run the open-source school platform on your own server with one Docker Compose file, or import it into CasaOS on a home server.' },
  { path: '/security', file: 'security.html', nav: 'Security', menu: true, title: 'Security and privacy for school data | SchoolKick', description: 'Default-deny routes, database row-level security, append-only attendance records and a plain list of what is not done yet.' },
  { path: '/faq', file: 'faq.html', nav: 'FAQ', menu: true, kind: 'faq', title: 'SchoolKick FAQ: cost, data, languages, mobile and limits', description: 'Answers to common questions about SchoolKick: price, who owns the data, mobile use, password reset, fees, and what the early release does not do yet.' },
  { path: '/roadmap', file: 'roadmap.html', nav: 'Roadmap', menu: false, title: 'SchoolKick roadmap: what is built and what comes next', description: 'What works in v0.1, the next planned slices (password reset, fees, notifications) and what is deliberately not planned until real schools confirm it.' },
  { path: '/contribute', file: 'contribute.html', nav: 'Contribute', menu: false, title: 'Contribute to SchoolKick: setup, checks and pull requests', description: 'How to run SchoolKick locally, the checks to run before a pull request, how the code is organised and the rules that keep it safe for school data.' },
  { path: '/contributors', file: 'contributors.html', nav: 'Contributors', menu: false, title: 'SchoolKick contributors', description: 'The people who build SchoolKick, and how to join them.' },
];
const dir = fileURLToPath(new URL('../../site/', import.meta.url));
const shotsDir = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

// A synthetic register for the hero. Seeded so it is stable between deploys and builds.
function register(): string {
  const names = ['Asha D.', 'Ben D.', 'Chitra D.', 'Dev D.', 'Esha D.', 'Farid D.', 'Gita D.', 'Hari D.'];
  const days = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14];
  let s = 7;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const cls: Record<string, string> = { p: 'Present', a: 'Absent', l: 'Late', e: 'Excused' };
  const rows = names.map((n, r) => {
    const cells = days.map((_, c) => {
      const x = rnd();
      const k = x < 0.8 ? 'p' : x < 0.88 ? 'a' : x < 0.95 ? 'l' : 'e';
      const fix = r === 2 && c === 7; // one corrected entry, marked with a dot
      return `<td class="${k}${fix ? ' fix' : ''}"><span class="sr">${cls[k]}${fix ? ', corrected' : ''}</span></td>`;
    });
    return `<tr><td>${n}</td>${cells.join('')}</tr>`;
  });
  return `<table class="register"><caption class="sr">Sample attendance register, Class 5A, November. Synthetic names.</caption><thead><tr><th scope="col">Nov</th>${days.map((d) => `<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const logo = '<svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor"/><path d="M12 24 32 14l20 10-20 10z" fill="#fff"/><path d="M20 32v10c0 4 6 8 12 8s12-4 12-8V32l-12 6z" fill="#fff" opacity=".85"/></svg>';

const FAQ_RE = /<details[^>]*><summary>(.*?)<\/summary>\s*<div>(.*?)<\/div>\s*<\/details>/gs;
const strip = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim();

function jsonLd(p: SitePage, siteUrl: string, repoUrl: string, body: string) {
  const url = siteUrl + (p.path === '/' ? '/' : p.path);
  const org = { '@type': 'Person', '@id': siteUrl + '/#maintainer', name: 'Raktim Ranjit', url: 'https://raktimranjit.com', sameAs: ['https://github.com/Raktim94'] };
  if (p.path === '/')
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': siteUrl + '/#website', name: 'SchoolKick', url: siteUrl + '/', inLanguage: 'en' },
      // No aggregateRating or review: there are none, and inventing one would break Google's structured data rules.
      { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SchoolKick', applicationCategory: 'EducationalApplication', operatingSystem: 'Web, Linux, Windows, macOS, Docker', description: p.description, url: siteUrl + '/', license: 'https://opensource.org/license/mit', codeRepository: repoUrl, screenshot: siteUrl + '/s/dashboard-desktop.png', author: org, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    ];
  const out: unknown[] = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl + '/' }, { '@type': 'ListItem', position: 2, name: p.nav, item: url }] }];
  if (p.kind === 'faq') {
    const qa = [...body.matchAll(FAQ_RE)].map((m) => ({ '@type': 'Question', name: strip(m[1]), acceptedAnswer: { '@type': 'Answer', text: strip(m[2]) } }));
    out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa });
  }
  if (p.kind === 'howto') {
    const steps = [...body.matchAll(/<h3 id="step-[^"]*">(.*?)<\/h3>/g)].map((m, i) => ({ '@type': 'HowToStep', position: i + 1, name: strip(m[1]), url: `${url}#step-${i + 1}` }));
    out.push({ '@context': 'https://schema.org', '@type': 'HowTo', name: 'Install SchoolKick', description: p.description, totalTime: 'PT15M', step: steps });
  }
  return out;
}



function layout(p: { title: string; description: string; path?: string; nav?: string; noindex?: boolean }, main: string, siteUrl: string, repoUrl: string, ld: unknown[] = []) {
  const url = siteUrl + (p.path === '/' ? '/' : p.path ?? '');
  const menu = PAGES.filter((x) => x.menu);
  const link = (x: SitePage) => `<a href="${x.path}"${x.path === p.path ? ' aria-current="page"' : ''}>${x.nav}</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"><link rel="canonical" href="${url}">`}
<meta name="author" content="Raktim Ranjit"><link rel="alternate" type="text/plain" href="/llms.txt" title="Plain-text summary for AI assistants">
<meta property="og:type" content="website"><meta property="og:site_name" content="SchoolKick"><meta property="og:locale" content="en"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${siteUrl}/s/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="A school attendance register with slash marks for present and circles for absent">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.description)}"><meta name="twitter:image" content="${siteUrl}/s/og.png"><meta name="theme-color" content="#2459A6">
<link rel="icon" href="/s/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/s/icon.svg"><link rel="stylesheet" href="/s/site.css">
${ld.map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join('\n')}
</head><body><a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap"><a class="brand" href="/">${logo} SchoolKick</a>
<nav class="desk" aria-label="Main">${menu.map(link).join('')}</nav>
<a class="btn" href="/app">Open the app</a>
<details class="mob"><summary>Menu</summary><nav aria-label="Mobile">${[PAGES[0], ...menu, ...PAGES.filter((x) => !x.menu && x.path !== '/')].map(link).join('')}<a href="${repoUrl}">Source on GitHub ↗</a></nav></details></div></header>
${main}
<footer><div class="wrap foot">
<div><a class="brand" href="/">${logo} SchoolKick</a><p>Open-source school attendance, MIT licensed. Early release: not security audited and not legally reviewed for any country.</p></div>
<nav aria-label="Product"><h2>Product</h2>${['/features', '/screenshots', '/roadmap', '/faq'].map((x) => link(PAGES.find((q) => q.path === x)!)).join('')}</nav>
<nav aria-label="Run it"><h2>Run it</h2>${['/get-started', '/self-hosting', '/security'].map((x) => link(PAGES.find((q) => q.path === x)!)).join('')}</nav>
<nav aria-label="Project"><h2>Project</h2><a href="${repoUrl}">Source code ↗</a><a href="${repoUrl}/issues">Report an issue ↗</a>${['/contribute', '/contributors'].map((x) => link(PAGES.find((q) => q.path === x)!)).join('')}<a href="/llms.txt">llms.txt</a></nav>
</div></footer>
<script src="/s/site.js" defer></script></body></html>`;
}

export function loadSite(siteUrl: string, repoUrl: string) {
  const reg = register();
  const fill = (h: string) => h.replaceAll('%SITE_URL%', siteUrl).replaceAll('%REPO_URL%', repoUrl).replaceAll('%REGISTER%', reg);
  const pages = new Map(
    PAGES.map((p) => {
      const body = fill(readFileSync(dir + p.file, 'utf8'));
      return [p.path, { html: layout(p, body, siteUrl, repoUrl, jsonLd(p, siteUrl, repoUrl, body)), mtime: statSync(dir + p.file).mtime }];
    }),
  );
  const notFound = layout({ title: 'Page not found | SchoolKick', description: 'This page does not exist.', noindex: true }, fill(readFileSync(dir + '404.html', 'utf8')), siteUrl, repoUrl);
  const assets = new Map<string, Buffer>();
  for (const f of ['site.css', 'site.js', 'icon.svg', 'og.png']) if (existsSync(dir + f)) assets.set(f, readFileSync(dir + f));
  if (existsSync(shotsDir)) for (const f of readdirSync(shotsDir)) if (f.endsWith('.png')) assets.set(f, readFileSync(shotsDir + f));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url><loc>${siteUrl}${p.path === '/' ? '/' : p.path}</loc><lastmod>${pages.get(p.path)!.mtime.toISOString().slice(0, 10)}</lastmod><priority>${p.path === '/' ? '1.0' : p.menu ? '0.8' : '0.5'}</priority></url>`).join('\n')}\n</urlset>\n`;
  // /app and /api are NOT disallowed here: they send X-Robots-Tag: noindex, and a crawler blocked by robots.txt would never see it.
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
  const llms = `# SchoolKick\n\n> Free, open-source (MIT) school attendance software you host yourself. Teachers mark attendance on a phone, families see today's status in a browser, and every correction keeps its history. Early release v0.1: not security audited, not legally reviewed for any country.\n\n## Pages\n${PAGES.map((p) => `- [${p.nav}](${siteUrl}${p.path}): ${p.description}`).join('\n')}\n\n## Source\n- [GitHub repository](${repoUrl})\n- Licence: MIT\n\n## Not built yet\nFees and payments, messaging, password reset by email, timetable and calendar, learning content, QR check-in, native mobile apps.\n`;
  return { pages, notFound, assets, sitemap, robots, llms };
}
