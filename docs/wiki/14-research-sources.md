# 14. Research sources and open questions

Accessed **2026-11-04**. Vendor pages show what a vendor *advertises*, not that a feature is effective or universally required.

| Source | Type | What it supports | Uncertainty |
|---|---|---|---|
| [Frappe Education docs – Introduction](https://docs.frappe.io/education/introduction) | Vendor docs (open source) | Student/teacher records, admissions, fee structures and online payment, course scheduling and exam planning, student portal with timetable/attendance/grades | Introduction page only; module depth not reviewed |
| [Fedena feature tour](https://fedena.com/feature-tour) | Vendor marketing | Advertises 22 core and 39 add-on modules: timetable, admissions, messaging, attendance, HR/payroll, finance, exams/gradebook, certificates, ID cards, SMS; add-ons for hostel, library, transport, inventory, gate management, alumni, online exams, assignments, auto timetable, integrations (Tally, QuickBooks, Google), mobile app | Marketing claims; counts not verified |
| [1EdTech OneRoster 1.2](https://standards.1edtech.org/oneroster/specifications/standards/v1p2) | Standards body | Rostering (users, courses, classes, enrolments, orgs, academic sessions), Gradebook (line items, results), Resources; REST/JSON and CSV bindings with OpenAPI | Conformance/certification requirements not assessed |
| [APAAR FAQs](https://apaar.education.gov.in/faqs) | Government (India) | 12-digit student ID; school-led creation; parental consent required for minors; links to DigiLocker, Academic Bank of Credits | Page does not name the issuing authority; integration API availability unknown |
| [UDISE+ 2020-21 booklet](https://www.education.gov.in/sites/upload_files/mhrd/files/statistics-new/UDISE%2B2020_21_Booklet.pdf) | Government (India) | School/teacher/enrolment statistics reporting context | **Could not be fetched (HTTP 403)** during this review; not summarised. Read manually before designing UDISE+ export |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Standards body | Nine new success criteria; W3C Recommendation 12 Dec 2024 | – |
| [DPDP Rules 2025 commentary (search results)](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/) | Law-firm/press | Rules notified 14 Nov 2025; verifiable parental consent for children's data, with a conditional educational-institution carve-out; most duties phased in over ~18 months | Commentary, not the Gazette; sources disagree on rule/schedule numbering. Needs counsel |

## Open product questions
1. Which segment and country do the first ten customers come from? (Drives i18n, finance and compliance order.)
2. Is UDISE+/APAAR integration desired, and is there a supported API? Read the UDISE+ booklet and ask schools.
3. Which payment provider, and who signs the contract?
4. Do customers want learner (student) accounts for minors, and under what consent model?
5. What retention periods do target schools need for attendance and fee records?
6. Is GPS transport tracking wanted enough to justify its privacy burden?
7. Should a tagged 0.3.0 release be cut (only `v0.1.0` exists on GitHub)?
