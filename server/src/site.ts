import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type SitePage = { path: string; file: string; title: string; description: string; nav: string };
export const PAGES: SitePage[] = [
  { path: '/', file: 'index.html', nav: 'Home', title: 'CampusOS: school attendance and family updates', description: 'Open-source school software. Teachers take attendance on a phone, families see today’s status in a browser, and every correction keeps its history.' },
  { path: '/features', file: 'features.html', nav: 'Features', title: 'Features: attendance, family view, CSV import | CampusOS', description: 'Attendance with correction history, a family view that needs no app, a school overview dashboard and a CSV importer that checks every row first.' },
  { path: '/security', file: 'security.html', nav: 'Security', title: 'Security and privacy for school data | CampusOS', description: 'Default-deny routes, database row-level security, append-only attendance records and a plain list of what is not done yet.' },
  { path: '/self-hosting', file: 'self-hosting.html', nav: 'Self-hosting', title: 'Self-host CampusOS with Docker or CasaOS', description: 'Run the open-source school platform on your own server with one Docker Compose file, or import it into CasaOS on a home server.' },
];
const dir = fileURLToPath(new URL('../../site/', import.meta.url));

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

function jsonLd(p: SitePage, siteUrl: string, repoUrl: string) {
  const url = siteUrl + (p.path === '/' ? '/' : p.path);
  if (p.path === '/')
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CampusOS', url: siteUrl + '/' },
      // No aggregateRating or review: there are none, and inventing one would break Google's structured data rules.
      { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CampusOS', applicationCategory: 'EducationalApplication', operatingSystem: 'Web, Docker', description: p.description, url: siteUrl + '/', license: 'https://opensource.org/license/mit', codeRepository: repoUrl, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    ];
  return [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl + '/' }, { '@type': 'ListItem', position: 2, name: p.nav, item: url }] }];
}

function layout(p: { title: string; description: string; path?: string; nav?: string; noindex?: boolean }, main: string, siteUrl: string, repoUrl: string, ld: unknown[] = []) {
  const url = siteUrl + (p.path === '/' ? '/' : p.path ?? '');
  const links = PAGES.map((x) => `<a href="${x.path}"${x.path === p.path ? ' aria-current="page"' : ''}>${x.nav}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${url}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="CampusOS"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${siteUrl}/s/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="A school attendance register with slash marks for present and circles for absent">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#2459A6">
<link rel="icon" href="/s/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/s/site.css">
${ld.map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join('\n')}
</head><body><a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap"><a class="brand" href="/">${logo} CampusOS</a><nav aria-label="Main">${links}</nav><a class="btn" href="/app">Open the app</a></div></header>
${main}
<footer><div class="wrap"><p>CampusOS is open source under the MIT license. Early release: not security audited, not legally reviewed for any country.</p><nav aria-label="Footer"><a href="${repoUrl}">Source code</a><a href="/security">Security</a><a href="/self-hosting">Self-hosting</a></nav></div></footer>
</body></html>`;
}

export function loadSite(siteUrl: string, repoUrl: string) {
  const reg = register();
  const fill = (h: string) => h.replaceAll('%SITE_URL%', siteUrl).replaceAll('%REPO_URL%', repoUrl).replaceAll('%REGISTER%', reg);
  const pages = new Map(PAGES.map((p) => [p.path, { html: layout(p, fill(readFileSync(dir + p.file, 'utf8')), siteUrl, repoUrl, jsonLd(p, siteUrl, repoUrl)), mtime: statSync(dir + p.file).mtime }]));
  const notFound = layout({ title: 'Page not found | CampusOS', description: 'This page does not exist.', noindex: true }, fill(readFileSync(dir + '404.html', 'utf8')), siteUrl, repoUrl);
  const assets = new Map(['site.css', 'icon.svg', 'og.png'].filter((f) => existsSync(dir + f)).map((f) => [f, readFileSync(dir + f)]));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url><loc>${siteUrl}${p.path === '/' ? '/' : p.path}</loc><lastmod>${pages.get(p.path)!.mtime.toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  // /app and /api are NOT disallowed here: they send X-Robots-Tag: noindex, and a crawler blocked by robots.txt would never see it.
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
  return { pages, notFound, assets, sitemap, robots };
}
