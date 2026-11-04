# 6. Learners, guardians, classes, enrolment

- Add a learner manually or by CSV. The import has a dry-run (`dryRun=1`) showing row/column errors; a file with invalid rows creates nothing.
- Link a guardian account to a learner; each link carries `can_pay`. A guardian sees only linked learners.
- Create classes, assign teachers, enrol learners.
- **Not built:** siblings view, emergency contacts, custody/access restrictions, consent history, accommodations, health notes, transfers/withdrawals, duplicate detection beyond `external_id` uniqueness, import rollback after commit, learner accounts. See [catalog](15-feature-catalog.md).
- Evidence: `server/test/api.test.ts` (import, scoping), `fees.test.ts` (guardian link without pay right).
