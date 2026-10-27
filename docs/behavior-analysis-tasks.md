# Behavior analysis implementation and review

Complete one task at a time. After implementation and verification, stop for the user's manual review. Start the next task only after the user approves continuing. Changes requested in review belong to the current task.

Additional requested change — AI configuration and generation modes: implemented, awaiting manual review. `ai.config.json` now selects on-demand or full preparation, and owns model, endpoint, thinking/effort, budgets, and timeouts. Credentials use ignored `ai.config.local.json` with existing environment credentials as a fallback. Selective mode is the default and generates only explicitly requested cards; full mode preserves the preparation gate. Verified with 142 automated tests, a successful build, and browser checks for both modes, responsive generation, consent, cache reuse/invalidation, and missing credentials. Provider calls were mocked. See [AI configuration](ai-configuration.md). Task 3 remains pending review.

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

Status: implemented; awaiting manual review.

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

Status: pending task 2 review.

- Model a workflow around one entry function and its reachable calls.
- Separate creation and cancellation operations in the same controller.
- Preserve shared helpers across workflows; record discovery evidence and uncertainty.
- Remove the silent 20-root limit and maintain stable workflow identities through history.
- Update workflow focus and AI context so unrelated sibling operations stay excluded.

Acceptance: the reservation example has distinct create/cancel paths; unused imports do not become called workflow steps. Workflow focus and history replay remain consistent.

## Task 4 — Framework entry points and workflow corrections

Status: pending task 3 approval.

- Implement one explicit framework adapter first: Express-style HTTP route registration, including named and inline handlers.
- Distinguish route registration from handler execution.
- Support user-selected entry functions, workflow names, and grouping corrections with saved project-specific overrides.
- Keep unknown registration and dispatch patterns explicit.

Acceptance: GET/POST routes become separate workflows with trigger evidence; corrections survive reopening the same project and do not silently apply to unrelated projects.

## Task 5 — Execution-path extraction

Status: pending task 4 approval.

- Add a behavior model between source extraction and rendering.
- Represent ordered operations, if/else branches, calls, early returns, throws, and try/catch/finally.
- Preserve await boundaries and mark unsupported loops, concurrency, and dynamic behavior explicitly before extending them.
- Record evidence locations and separate direct facts from inferred effects.
- Cover reservation success, duplicate requests, charge failure cleanup, and cancellation ordering with executable examples.

Acceptance: extracted paths agree with executable fixture outcomes; exceptions and cleanup do not acquire false execution-order guarantees. This is static analysis, not a runtime recording.

## Task 6 — Behavioral-flow exploration and verification

Status: pending task 5 approval.

- Render branches, outcomes, and failure paths with expandable calls.
- Allow users to inspect one possible scenario without hiding alternative paths.
- Make flow animation follow the selected path and retain clear static-analysis labels.
- Generate AI descriptions from extracted paths and evidence.
- Validate with the reservation example and an Express fixture, including browser interaction checks.

Acceptance: users can distinguish success, duplicate-return, charge-failure cleanup, and cancellation paths. Unsupported behavior remains visible, and dependency edges cannot be mistaken for observed execution.
