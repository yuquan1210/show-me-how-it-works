# Ticket reservations explanation review

Tested locally with actual DeepSeek API requests, using the server's configured `DEEPSEEK_API_KEY` and `deepseek-flash`. The key was not printed, copied to browser storage, committed, or published. The comment-free TypeScript implementation was sent with approval; the sample README and its expected answers were not sent to the model.

## Issues found and changes made

| Issue observed | Change |
| --- | --- |
| Function cards attributed service checks and effects to controller wrappers. | Explicit selected-unit IDs and source roles; directed callee context rather than incoming callers; instructions to distinguish local behavior from delegation. |
| Storage and initial seat capacity were described as unknown because module declarations were missing. | Include module state, constants and imported types, including files with no functions. |
| Pricing descriptions omitted the base rate, blurred coupon branches, or called exact comparisons unknown. | Parser-derived branches, returns and arithmetic facts; caller result names establish units. Function cards missing selected arithmetic values are rejected and rewritten. |
| Failure descriptions missed rollback boundaries or effects skipped after a refund error. | Separate source-grounded review of every card, with reasoning enabled for function reviews. |
| Drafts invented details, such as a missing payment token despite object spread, real monetary effects in a simulation, or unsupported concurrency guarantees. | Review instructions trace object spread, early returns, synchronous callee effects and awaits; source remains authoritative over generated drafts. |
| Independent cards disagreed about the same helper. | Generate callee functions before callers where possible; supply completed function cards to callers and higher-level summaries. |
| Strict word limits repeatedly blocked opening the project over a few extra words. | Short fields stay within 24 words; complex fields target 32 with a 40-word safety limit. Identify offending fields and allow two bounded repairs. |
| Excessive header space hid most of the explanation. Generic box subtitles contributed little understanding. | Compact detail headings, collapse optional questions, and use ready AI purposes as graph subtitles. Both detail tabs retain matching fields. |
| Progress said users could keep exploring while the project was blocked. | Remove that misleading message; distinguish generation, accuracy review and clarity repair. |

## Review rubric

Check the generated cards against these source-derived outcomes, not just whether the cards sound plausible:

- Creation validates a nonblank request identifier, integer seats from 1 to 6, and an email containing an at-sign. It normalizes email locally, then delegates.
- The same saved request identifier returns its existing reservation before pricing, seat taking or payment. The lookup/save sequence is not an atomic concurrency guarantee.
- Price is 2,500 cents per seat. Four or more seats get a rounded 10% discount. Exact uppercase WELCOME subtracts 500 cents. Zero-clamping applies to that coupon branch, not every return path. Four seats with WELCOME cost 8,500 cents.
- A failed charge releases taken seats and rethrows. Pricing fails before seat-taking; cleanup must not be attributed to every possible error.
- Cancellation checks owner before status, returns an already-cancelled reservation unchanged, and orders refund, seat release, then save. Refund failure prevents the latter two effects.
- Payments are simulated map entries, not a real payment provider. Reservation storage and the initial 12-seat counter are module-local memory.
- Repository helpers do not independently enforce controller-level seat validation. Saving overwrites a shallow copy; lookup by request returns the stored match, while lookup by identifier returns a copy.
- Each function card excludes unrelated sibling operations. Component and workflow summaries may cover their members, but must identify delegated behavior.

## Verification and limits

The sample's independent executable checks pass for pricing, duplicate handling, rollback and repeat cancellation. Automated regression tests cover source scoping, type/module evidence, cache invalidation, deterministic ordering, bounded context, numeric coverage, review-before-acceptance, bounded repairs, bottom-up summaries, and exclusion of raw evidence from history exports. The proxy returns final text only, never provider reasoning or credentials.

Additional direct execution confirmed that email normalization does not mutate the original input; an empty coupon takes the early pricing path; negative seats without a coupon are not zero-clamped; concurrent same-request calls can create distinct payment records; concurrent cancellation can reject the second call with Payment not found; lookup by identifier returns a copy while lookup by request returns the stored object.

The preparation screen still requires every card before opening the canvas. Caching avoids new requests when an unchanged, fully explained project is reopened.

AI self-review is not a correctness proof. The tests validate the pipeline and selected factual coverage, not every natural-language claim. Complex runtime behavior, concurrency and external integrations still require independent evidence. First-time generation is slower and uses more tokens: normally a draft plus a review per card, with extra requests only for repairs. Reasoning is reserved for detailed function reviews to avoid expensive repeated reasoning over whole-project summaries.
