# 7. Fees, payments, receipts, reconciliation, refunds

Money design rules (from `docs/traceability.md` and tests):
- Invoices are numbered, immutable, in integer minor units. Void with a reason; never deleted; blocked once paid.
- **"Paid" is never inferred** from a return URL or a payer's claim. It follows a signed, idempotent provider webhook, or an authorised staff entry.
- UPI (INR only): the guardian gets a QR for the exact outstanding amount, then gives the UTR; finance/owner confirms against the bank statement in the reconciliation queue.
- Only one open online/UPI payment per invoice (database-enforced); the family sees "Do not pay again yet" with a reference while money may be in flight.
- Receipts: numbered after verified payment; PDF with a verification QR; the public verification page shows no names. Latin and Devanagari text render; other scripts do not.
- Refunds: finance requests, **owner** approves. Approval *records* the refund; money is returned outside the system (no provider-side refund).
- Financial rows are immutable at SQL level.

**Boundaries:** institution–learner fees only. SchoolKick does not charge for itself, and there is no ledger, cashbook, expenses, scholarships, instalment plans, late fees on invoices, or accounting export (*Planned*).

**Real card/bank gateway:** *Planned; needs a provider contract and keys.* Only a test provider exists.
