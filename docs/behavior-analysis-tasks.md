# Behavior analysis implementation and review

The ongoing checklist is [TODO.md](TODO.md). The user completed review of the delivered improvements on 2026-10-28; this document retains their implementation and verification record. Future tasks are tracked in that checklist.

Current authorization: the user asked to continue autonomously during their absence, skipping work that needs a human design decision. This supersedes the earlier pause after each task. Keep the existing UI minimal, improve existing features only, and never push commits.

AI configuration and selective generation were delivered in the preceding local commits. This pass implements operation discovery and bounded behavior extraction, improves existing detail/connection cards, and verifies the UI. No saved correction editor, scenario selector, additional canvas level, or remote Git connector is introduced.

## Task 1 — Project-aware import resolution

Status: approved for continuation.

Read recognized compiler configuration from the imported snapshot. Use TypeScript resolution for both component dependencies and function calls. Apply the same resolver to folder imports, Git-history exports, and supporting explanation evidence.

Delivered:

- Root and nearest nested `tsconfig.json` / `jsconfig.json` settings.
- `baseUrl`, `paths` aliases (including fallback targets), and module-resolution strategies.
- Local configuration inheritance, with JSON comments and trailing commas.
- Compiler config collection in both browser folder-import methods and history export.
- Alias-imported types and module declarations in explanation context; configuration bodies are excluded.
- Configuration warnings and a “Check project settings” action. Invalid/missing settings do not stop otherwise resolvable analysis.
- Regression tests for alias resolution, scoped settings, inherited settings, extensions, evidence invalidation, and historical configuration changes.

Verification: all 91 automated tests pass; production build passes with the existing large-analyzer-chunk warning. A headless Chrome check imported alias-based history, opened the settings-warning dialog, and found no browser errors or AI-generation requests.

Review:

1. Inspect `src/project-config.js`: all reads use the selected snapshot; no disk, network, or package installation is involved.
2. Run `node --test tests/project-config.test.js tests/history-export.test.js`.
3. Check that `@/store` resolves to `src/store.ts` with `paths: {"@/*": ["src/*"]}`. Changing the target to `alternative/*` must change both component and function edges without editing the caller.
4. With a configured AI provider, open a project containing these aliases and inspect its map. Existing all-explanations-before-opening behavior is unchanged.
5. Import a project with an unavailable `extends` config: once the canvas is accessible, “Check project settings” must explain that dependency paths may be incomplete.

Limits at task 1 review: only conventionally named compiler configs inside the snapshot are read. Package-provided settings, package exports, custom config filenames, and bundler-only aliases remain unsupported. Reference selection and complete barrel/module traversal were deferred to task 2 and are delivered there.

## Task 2 — Coverage and dependency boundaries

Status: implemented before this pass; continuation authorized by the latest instruction.

- Retain important modules with state, initialization, constants, or re-exports even without named functions.
- Follow barrel/re-export chains consistently in component maps and explanation evidence.
- Add explicit unresolved-call and external-dependency records, with reasons and coverage counts.
- Expand config selection to referenced projects and report unsupported resolution features clearly.
- Improve extraction of constructor/method and callback relationships without guessing dynamic targets.

Acceptance: representative fixtures show retained boundaries and unresolved operations; unresolvable calls never become fabricated links. Existing canvas, explanations, and history support the expanded model.

Delivered:

- Retain every nonempty supported source module internally, including shared values/types, re-exports, and startup code. Components group implementation by inferred responsibility; supporting declarations are folded into details and labeled when shared. Meaningful startup operations remain components. There is no file-level canvas view.
- Resolve import and re-export chains consistently; distinguish type-only and re-export edges from runtime call claims.
- Record calls/constructions with source locations, resolved targets or explicit external/unresolved reasons. Runtime operations and missing configured aliases are distinguished.
- Extract constructors, accessors, field functions, anonymous functions, and callback bodies. Overload signatures map to a unique implementation. Callback arguments remain separate references rather than fabricated invocation edges.
- Select uniquely matching solution-style referenced configs using TypeScript membership rules; warn about missing, circular, and overlapping references.
- Add a filterable, paginated analysis-coverage report on the preparation screen and canvas, plus module/function reports in details.
- Include bounded coverage and callback evidence in AI context and cache revisions. Module source is used only internally after consent.
- Preserve coverage through history export/import, validate metadata, strip imported source evidence, and keep older history exports compatible.
- Add `examples/analysis-coverage` as a deliberately non-executable review fixture with absent external SDKs.

Verification of the initial task 2 implementation: all 114 automated tests passed; production build passed with the existing large-analyzer-chunk warning. Browser checks covered coverage reports and source retention. The manual-review adjustment below supersedes the initial one-module-per-component presentation.

Manual-review adjustment: group domain implementation files into responsibility cards; fold data/types/public exports into supporting details; show shared consumers; connect through export wrappers; preserve function selection, workflow focus, and history changes over the complete underlying analysis. Component AI jobs include folded sources instead of separate supporting-file cards. Grouping is inferred from domain folders or normalized names. No file-level canvas is added.

Adjustment verification: all 126 tests pass, including responsibility grouping, shared support, export cycles, type-only evidence, selection indices, component AI context, and history propagation. The production build passes with the existing large-analyzer-chunk warning. Browser checks confirm the three-card review sample, supporting/shared details, component/function coverage, connection inspection, function selection, history changes, and the existing three canvas levels. No AI requests were made; live provider generation was not exercised.

Manual review:

1. Start the app and open `examples/analysis-coverage`.
2. In default selective mode, choose **Analysis coverage** on the canvas. In full mode, choose **Review analysis coverage** on the preparation screen. No key or provider request is required for this report.
3. Check **Unresolved operations** for the notification callback. It must have a reason and location, without a guessed implementation.
4. Select **Module dependencies**, then `src/booking/index.ts`; inspect its re-export and type-only records.
5. Select `src/main.ts`, then **Callbacks passed**. The timer callback must say invocation and timing are not established.
6. Inspect Components: Application entry, Booking, and Startup are the three cards. Booking details contain its public exports, data, and types; types are marked shared with Application entry. Functions still show the explicit constructor, methods, and inline callback. Selective mode does not require AI cards before exploration.
7. Run `npm test` to verify configuration membership, coverage, evidence, history compatibility/privacy, and graph layout regressions.

Remaining limits: counts describe the imported supported source snapshot; excluded or oversized files are not counted as analyzed. Runtime traces, framework entry-point discovery, execution order, callback invocation/timing, implicit constructor/accessor calls, and complete dynamic dispatch remain outside this task. Non-literal module locations stay unresolved. External implementations and package exports are not inspected. Reports in history describe the full source snapshot for the selected commit, independently of workflow focus; module/function reports filter those records. AI preparation gates the canvas only when full mode is configured.

## Task 3 — Operation-based workflow discovery

Status: implemented and verified.

- Workflows start at a public operation and follow resolved calls. Create/cancel in one controller remain separate and retain shared helpers.
- Public export boundaries and inferred uncalled entry operations carry discovery evidence. Controller helpers and unused implementation imports do not become workflow steps. There is no 20-operation cap.
- Existing canvas filtering, component details, summary cards, follow-up context, and history use the same selected operations. Scoped AI cards have separate identities so a global component explanation cannot leak into a narrower workflow view.
- Per-operation canonical fingerprints retain unique moved entries and avoid comment/format-only history noise. A sibling-only change is excluded; changes in shared state remain possible impacts.
- Nested calls with the same starting position now have distinct coverage IDs.

## Task 4 — Framework entry points

Status: automatic discovery implemented; saved manual corrections deferred for design review.

- An explicit Express adapter recognizes imports/require, immutable receiver aliases, named/inline handlers, middleware references, imported mounted routers, and route chains.
- HTTP method/path become workflow names and triggers. A uniquely registered inline callback gets a meaningful handler label.
- Unknown handlers/paths, computed mounts, duplicate routes and unmounted routers remain unresolved or uncertain. Arbitrary objects with get/post methods do not become HTTP workflows.
- Registration and passed middleware are not turned into direct invocation edges. Middleware continuation, actual mounting/execution, route matching precedence and error middleware dispatch are not verified.

Deferred: project-specific entry/name/grouping correction editors and persistence are new features. They need a reviewed design under the latest scope restriction.

## Task 5 — Execution-path extraction

Status: bounded static extraction implemented and verified against executable reservation outcomes.

- A source-ordered tree retains branches, local value transformations, calls, await flags, early returns, explicit throws, and try/catch/finally regions with source positions.
- Existing structural cards now retain arithmetic, exact comparisons, early outcomes and scoped recovery. Pricing includes 2500 per seat, a four-seat threshold, rounded 0.9 multiplication, and the 500 deduction with a final-branch clamp.
- Connection details distinguish protected charge failures from pricing errors outside the catch, and show refund completion before cancellation release/save. Unawaited promise rejections are not described as caught merely because a call appears inside try.
- Loops/switches, complex expressions, shortened outlines and scheduling remain explicit limitations. Calls and name-based effects are static inferences, not runtime traces or a complete symbolic execution engine.
- AI context includes bounded selected execution paths. History validates and retains only the known path schema; source bodies remain excluded.

Verification includes executing the TypeScript reservation fixture after transpilation: duplicate requests return before new payment, charge failure restores capacity, pricing failure occurs before reservation, failed refund leaves capacity held and status confirmed, and coupon/rounding results agree with the extracted branches.

## Task 6 — Existing behavioral-flow exploration

Status: improvements within existing UI implemented; new scenario controls deferred.

- Existing function/component structural fields and connection inspectors explain important conditions and recovery without another canvas mode or panel.
- Workflow selection removes sibling operations from functions, grouped components and explanations. History applies the same scope.
- Existing animation illustrates possible call topology, not a selected execution scenario. History continues to suspend live workflow animation.
- Fixed explanation progress covering commit buttons when history opened.
- Re-importing an append-only history keeps the selected commit and workflow, pauses playback, and reports newly available commits. Different branches or rewritten histories start a fresh review. The same file can be imported again.

Deferred: interactive scenario selection, branch-path playback and expandable execution-path graphs would add product features. They are not implemented in this pass.

## Verification and remaining review

Final results: all 173 automated tests pass, the production build passes with the existing large analyzer chunk warning, and both installed-Chrome browser suites pass. Provider calls were mocked or blocked; live provider quality was not evaluated.

Run `npm test`, `npm run build`, `npm run test:workflow-ui -- http://127.0.0.1:5197/`, and `npm run test:ai-ui -- http://127.0.0.1:5197/` against a running local server. Browser tests use installed Chrome and mock/block every AI provider request.

Browser coverage: create/cancel isolation; pricing thresholds and early returns; charge/pricing connection recovery; keyboard connection selection; grouped component scope; a 1024px viewport; workflow history and repeated refreshed import; Express GET/POST isolation; coverage reports; selective generation responsiveness and cache invalidation; full preparation blocking and missing credentials. Screenshots are generated in ignored `test-results/`.

Human review remains useful for inferred responsibility naming, which frameworks should be supported next, and whether saved corrections or scenario exploration justify more UI. See [Git-history import proposal](git-history-import.md) for the requested repository URL and refresh assessment. No remote fetch, pull, clone or push was performed.
