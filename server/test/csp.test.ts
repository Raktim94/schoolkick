import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { client, freshApp } from './helpers.ts';

let env: Awaited<ReturnType<typeof freshApp>>;
before(async () => { env = await freshApp(); });
after(async () => { await env.close(); });

describe('content security policy', () => {
  it('lets the static marketing pages run their inline bootstrap scripts, so they hydrate', async () => {
    for (const path of ['/', '/get-started/', '/features/']) {
      const csp = (await client(env.app).get(path)).headers.get('content-security-policy') ?? '';
      assert.match(csp, /script-src 'self' 'unsafe-inline'/, path);
      assert.match(csp, /style-src-attr 'unsafe-inline'/, path); // framework-injected style attributes only; <style> blocks stay hash-only
      assert.match(csp, /frame-ancestors 'none'/, path);
    }
  });
  it('keeps the app and API strict: no inline script allowed', async () => {
    for (const path of ['/app/', '/api/v1/classes', '/api/v1/openapi.json']) {
      const csp = (await client(env.app).get(path)).headers.get('content-security-policy') ?? '';
      assert.doesNotMatch(csp, /unsafe-inline/, path);
      assert.doesNotMatch(csp, /script-src|style-src-attr/, path); // falls back to default-src 'self'
    }
  });
});
