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
  const publicDir = resolve('web/next-build');
  const site = loadSite(o.siteUrl, o.repoUrl);
  const hasApp = existsSync(o.appDir + '/index.html');
  const appIndex = hasApp ? readFileSync(o.appDir + '/index.html', 'utf8') : '';
  app.use('*', compress());

  app.get('/robots.txt', (c) => { const f = resolve(publicDir, 'robots.txt'); return existsSync(f) ? c.text(readFileSync(f, 'utf8')) : c.text(site.robots); });
  app.get('/install-linux.sh', (c) => (site.installer ? c.body(site.installer, 200, { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' }) : c.notFound()));
  app.get('/downloads/:file', (c) => {
    const m = /^schoolkick-(amd64|arm64)\.deb$/.exec(c.req.param('file'));
    return m ? c.redirect(`${o.repoUrl}/releases/download/v${DEB_VERSION}/schoolkick_${DEB_VERSION}_${m[1]}.deb`, 302) : c.notFound();
  });
  app.get('/favicon.ico', (c) => { const f = resolve(publicDir, 'favicon.ico'); if (existsSync(f)) return c.body(readFileSync(f) as unknown as ArrayBuffer, 200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' }); const old = site.assets.get('favicon.ico'); return old ? c.body(old as unknown as ArrayBuffer, 200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' }) : c.notFound(); });
  app.get('/llms.txt', (c) => { const f = resolve(publicDir, 'llms.txt'); return c.text(existsSync(f) ? readFileSync(f, 'utf8') : site.llms, 200, { 'Cache-Control': 'public, max-age=3600' }); });
  app.get('/sitemap.xml', (c) => { const f = resolve(publicDir, 'sitemap.xml'); return c.body((existsSync(f) ? readFileSync(f) : Buffer.from(site.sitemap)) as unknown as ArrayBuffer, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }); });

  app.get('/s/:file', (c) => {
    const nextFile = resolve(publicDir, 's', c.req.param('file'));
    if (nextFile.startsWith(resolve(publicDir, 's') + sep) && existsSync(nextFile)) return c.body(readFileSync(nextFile) as unknown as ArrayBuffer, 200, { 'Content-Type': MIME[extname(nextFile)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
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
    const relativePath = path === '/' ? 'index.html' : `${path.slice(1)}/index.html`;
    const staticFile = resolve(publicDir, relativePath);
    if (staticFile.startsWith(publicDir + sep) || staticFile === resolve(publicDir, 'index.html')) {
      const buf = existsSync(staticFile) ? readFileSync(staticFile) : null;
      if (buf) return c.body(buf as unknown as ArrayBuffer, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    }
    const assetPath = resolve(publicDir, `.${c.req.path}`);
    if (assetPath.startsWith(publicDir + sep) && extname(assetPath)) {
      const buf = existsSync(assetPath) ? readFileSync(assetPath) : null;
      if (buf) return c.body(buf as unknown as ArrayBuffer, 200, { 'Content-Type': MIME[extname(assetPath)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
    }
    const page = site.pages.get(path);
    if (page) return c.html(page.html, 200, { 'Cache-Control': 'public, max-age=300' });
    return c.html(site.notFound, 404); // a real 404, not a soft one
  });
}
