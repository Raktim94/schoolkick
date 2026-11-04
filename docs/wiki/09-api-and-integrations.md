# 9. API and integrations

- JSON API under `/api/v1`. The route list with required roles is generated from the same registry that enforces access: `GET /api/v1/openapi.json`. **Request/response schemas are incomplete.**
- Authentication is a session cookie (HttpOnly, SameSite) with a CSRF header and origin check. There are **no API keys, scoped credentials, outbound webhooks or versioning policy yet** (*Planned*).
- Inbound webhook: `POST /webhooks/payments/sandbox`, HMAC-SHA256 signed, idempotent, out-of-order safe. Test provider only.
- Public data: receipt verification (`/verify/:id/:sig`) only. **No public-website content API exists.** When one is built it must expose only explicitly published content (admissions info, calendar, public course descriptions) with scoped, revocable, rate-limited keys, and never learner, guardian, staff, payment or location data.
- Standards to evaluate (not implemented): 1EdTech OneRoster 1.2 CSV/REST for rostering exchange. See [research](14-research-sources.md).
- AI: the public site publishes `/llms.txt` for documentation only. The product has no AI features and sends no learner data to external AI services.
