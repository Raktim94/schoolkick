# 8. Exam registration and current limitations

Works: create an exam with subjects, fee, registration window (open, late with late fee, closed) and attendance-eligibility rule; guardians register linked children (creating the fee invoice); staff may register on behalf with an override reason; staff approve a *paid* registration, which issues a hall-ticket number; guardians view the ticket only after approval. Evidence: `server/test/exams.test.ts`, `e2e/`.

Not available: marks entry, moderation, result release, report cards, transcripts, seating plans, invigilation. These are the next academic slice (see [roadmap](13-roadmap-and-modules.md)); until built, do not describe SchoolKick as running examinations end to end.
