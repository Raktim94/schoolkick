# 5. Attendance and correction history

- **Taking a register:** teacher opens an assigned class, learners start unmarked; mark exceptions, save. Works on a phone browser.
- **Corrections:** changing a saved mark requires a reason. The original event, the new event, the actor and the time are all kept.
- **Storage:** `attendance_events` and `audit_events` reject UPDATE and DELETE by trigger and privilege. The current mark is the latest event per class, learner and day.
- **Viewing:** `GET /classes/:id/attendance/history` lists every event for a day, newest first. Guardians see the current status for linked children; owners see an audit log (latest 200).
- **Evidence:** `server/test/api.test.ts` (attendance, teacher scoping, correction); `e2e/run.mjs`.
- **Limits:** one register per class per day (no period/session attendance), no leave workflow, no teacher/staff attendance, no QR check-in, no notifications to guardians. All *Planned*.
