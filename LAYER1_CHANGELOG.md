# Layer 1 implementation changelog

This ZIP contains the Layer 1 product/copy/UX implementation applied after the end-to-end audit. It is intentionally conservative around payment and production backend logic: commercial prices and financial schema were not rewritten without a verified provider/database migration plan.

## Implemented
- 5-link primary header
- compact footer
- live channel filtering and accessible tabs
- corrected channel counts/state
- removal of unsupported homepage traction figures
- outcome-first English homepage messaging
- platform-mediated request language
- payment-flow wording in English customer copy
- corrected stale E2E public route assumptions
- audit documents and page/service CSVs

## Not silently changed
- Business activation price remains the repository source of truth (R399)
- Publisher activation price remains R199
- Platform commission remains 8%
- Financial schema/Edge Functions were not rewritten
- Production database state was not assumed
