import type { Hono } from 'hono';
import { compress } from 'hono/compress';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { DEB_VERSION, loadSite } from './site.ts';

const MIME: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2' };

/** Public site (static, SEO-friendly), the app under /app, and crawler files. Registered after the API. */
export function mountWeb(app: Hono, opts: { siteUrl: string; repoUrl: string; appDir: string }) {
  const o = { ...opts, appDir: resolve(opts.appDir) };
  const site = loadSite(o.siteUrl, o.repoUrl);
  const hasApp = existsSync(o.appDir + '/index.html');
  const appIndex = hasApp ? readFileSync(o.appDir + '/index.html', 'utf8') : '';
  app.use('*', compress());

  app.get('/robots.txt', (c) => c.text(site.robots));
  app.get('/install-linux.sh', (c) => (site.installer ? c.body(site.installer, 200, { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' }) : c.notFound()));
  app.get('/downloads/:file', (c) => {
    const m = /^schoolkick-(amd64|arm64)\.deb$/.exec(c.req.param('file'));
    return m ? c.redirect(`${o.repoUrl}/releases/download/v${DEB_VERSION}/schoolkick_${DEB_VERSION}_${m[1]}.deb`, 302) : c.notFound();
  });
  app.get('/favicon.ico', (c) => { const f = site.assets.get('favicon.ico'); return f ? c.body(f as unknown as ArrayBuffer, 200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' }) : c.notFound(); });
  app.get('/llms.txt', (c) => c.text(site.llms, 200, { 'Cache-Control': 'public, max-age=3600' }));
  app.get('/sitemap.xml', (c) => c.body(site.sitemap, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }));

  app.get('/s/:file', (c) => {
    const f = site.assets.get(c.req.param('file'));
    if (!f) return c.notFound();
    return c.body(f as unknown as ArrayBuffer, 200, { 'Content-Type': MIME[extname(c.req.param('file'))] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
  });

  app.get('/app/*', async (c) => {
    if (!hasApp) return c.text('The web app is not built. Run: npm run build', 503);
    const rel = c.req.path.slice('/app/'.length);
    const full = resolve(o.appDir, rel);
    if (rel && extname(rel) && full.startsWith(o.appDir + sep)) {
      const buf = await readFile(full).catch(() => null);
      if (buf) return c.body(buf as unknown as ArrayBuffer, 200, { 'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream', 'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      if (rel.startsWith('assets/')) return c.notFound();
    }
    return c.html(appIndex, 200, { 'Cache-Control': 'no-cache' }); // client-side routes
  });
  app.get('/app', (c) => (hasApp ? c.html(appIndex, 200, { 'Cache-Control': 'no-cache' }) : c.text('The web app is not built. Run: npm run build', 503)));

  app.get('*', (c) => {
    const path = c.req.path.length > 1 ? c.req.path.replace(/\/$/, '') : c.req.path;
    const page = site.pages.get(path);
    if (page) return c.html(page.html, 200, { 'Cache-Control': 'public, max-age=300' });
    return c.html(site.notFound, 404); // a real 404, not a soft one
  });
}
