# Product improvement and feature checklist

This is the ongoing task tracker. Planning only: an unchecked item is not authorization to implement it. Update this file as work progresses; keep task IDs stable. Check an item only after its acceptance criteria are met, record verification, and identify any remaining review.

Updated: 2026-10-28. The user has completed review of the delivered analysis improvements. No further implementation has started. This file consolidates the pending work from the conversation, earlier task plan, review notes and documented limitations. Deferred items remain deferred; listing a limitation does not commit us to solving every possible case.

## Product rules

- Help users understand and review the important architecture and workflow behavior, rather than every implementation detail.
- Keep the UI minimal. Reuse the existing map and details window where possible; no file-level canvas or raw-code review view.
- Distinguish static evidence, inferred behavior, AI interpretations and unknowns. The app is not a source of truth or a runtime recording.
- Test visible changes in the browser, including realistic map sizes and narrow windows.
- Evaluate established tools before extending custom analysis or layout logic. Adopt them only when evidence shows an improvement.
- Never push commits.

## How to read and use this list

Each task explains the current problem, the intended experience, a concrete example, and the work needed to finish it. The examples illustrate the desired behavior; they do not claim that a particular project contains those rules.

The task checkbox means the whole task is delivered and verified. Smaller checkboxes track individual steps. Tool evaluations produce recommendations first; they do not automatically authorize a migration. Screen arrangements described below are proposals to review, not fixed designs.

## Improvements to existing features

### I01 — Understand what changed inside an updated box

- [ ] **I01 complete — A reviewer can understand a modified box's important before/after differences.**

**The problem today:** A box can be marked Updated, but a label such as “Implementation changed” does not explain the significance. A reviewer still needs to work out whether validation, pricing, storage, calls, or failure handling changed.

**What the user should experience:** While viewing a commit, click an updated box. Its existing details window includes **What changed**, with a short explanation of the important differences. In that same window, compare the structural analysis **before this commit** with the analysis **after this commit**. Make the fields that changed easy to spot; keep unchanged information secondary. Use the available window width sensibly: two columns or a simple before/after switch are options, not requirements to build both.

**Example:** A pricing rule changes from a discount for four or more seats to a discount for six or more seats. The explanation should say “The group-discount threshold increased from 4 seats to 6.” The comparison should show the old condition and the new condition. It should not just say that the pricing function changed, and it should not require reading a code diff.

**What counts as an important change:** Changed inputs, validation rules, calculations, early returns, observable updates, error recovery, responsibility boundaries, or connections to other components. A changed box might also depend on a changed shared value. In that case, explain the dependency and avoid claiming a confirmed behavior change if the effect cannot be established.

**Work checklist:**

- [ ] Design the comparison inside the existing details window, including a narrow-window layout.
- [ ] Compare the selected commit with its immediate parent, even when playback skipped other commits. For example, selecting commit 10 compares 9 → 10, not the last commit the user happened to view.
- [ ] Compare matching structural fields and produce a concise, source-grounded change summary. Begin with static comparison; decide separately whether optional AI wording is worthwhile.
- [ ] Keep the comparison within the selected workflow and responsibility. An unrelated cancellation edit must not appear as a booking-creation change.
- [ ] Handle grouped components and shared data without enumerating every changed file.
- [ ] Show an explicit unavailable/incomplete message when either snapshot lacks enough analysis. Do not fabricate an earlier explanation.
- [ ] Verify changed calculations, validation, calls and cleanup in browser tests. Also check that added/deleted boxes keep their normal details and do not get an unnecessary comparison.

**Finished when:** A reviewer can identify the consequential change from the details window, see the supporting before/after structural descriptions, and distinguish known differences from possible impacts. This task improves history already imported; it does not add Git importing or remote synchronization.

### I02 — Evaluate established tools for more reliable structural analysis

- [ ] **I02 complete — We have an evidence-based recommendation on what analysis to reuse.**

**The problem today:** The app uses the TypeScript compiler API to read code, but much of the logic for discovering workflows, following calls and explaining branches is our own. That logic has limits. Maintaining more custom rules may be less robust than using an established analyzer for some of the work.

**What we want:** Find out whether existing static-analysis tools can supply better evidence while the app continues to present a small number of understandable responsibilities, workflows and behavior cards. The user should not have to learn the chosen analysis tool or navigate its internal graph.

**Example:** An entry function calls an imported helper through an alias. The helper charges a payment inside a try/catch and releases a reservation on failure. A candidate tool should be tested on whether it finds the right helper and exception boundary, rather than judged only on whether it can list files or functions.

**Work checklist:**

- [ ] Write down the gaps to evaluate: entry discovery, call targets, branches, early returns, exceptions, awaited operations and project configuration.
- [ ] Research suitable maintained tools and record what each actually supports. Separate JavaScript/TypeScript support from claims about other languages or frameworks.
- [ ] Run a small, shared set of examples through the current analysis and the candidates. Include a case with dynamic behavior that should remain unknown.
- [ ] Compare correct findings, missed findings, misleading claims, speed and output size. More connections are not automatically better.
- [ ] Check installation needs, browser versus local-server operation, licensing, maintenance, source privacy and the ability to analyze a historical snapshot without running the application.
- [ ] Produce a readable comparison with examples and recommend retaining our approach, supplementing a specific part, or replacing a specific part.
- [ ] Describe the proposed integration boundary and migration risks if a candidate is recommended. Keep implementation as a separate decision after reviewing the findings.

**Finished when:** We can explain which tool, if any, improves which specific weakness, backed by reproducible examples. There is no requirement to adopt a tool merely because it exists, and this task does not promise complete runtime understanding.

### I03 — Evaluate Graphify and existing graph/layout tools

- [ ] **I03 complete — We know whether an existing tool would make graph generation or arrangement better.**

**The problem today:** We have custom logic for grouping boxes, arranging them into dependency columns and routing arrows. Dense graphs and cycles can still be difficult to read. A tool called Graphify may help, but we first need to establish exactly which project it is and which problem it solves.

**Two different questions:** Discovering “Booking calls Payment” is an analysis problem. Deciding where the Booking and Payment boxes should sit, and where the arrow should run, is a drawing problem. A candidate might help with one, both, or neither. We should assess those roles separately.

**Example:** A map has several responsibilities with shared dependencies and a circular connection. Compare the current layout and candidate layouts using the same boxes and connections. Look at whether arrows cross unnecessarily, labels remain readable and a small change causes the entire map to move.

**Work checklist:**

- [ ] Identify the exact Graphify repository/package and inspect its documented capabilities. Keep it a candidate until its applicability is known.
- [ ] Classify each candidate: relationship extraction, grouping, box placement, arrow routing, or rendering. Coordinate analysis candidates with I02 rather than running two disconnected evaluations.
- [ ] Compare applicable established tools with our current implementation using the same small, dense, cyclic and larger graph fixtures.
- [ ] Inspect overlapping boxes, lines through boxes, crossings, spacing, group boundaries and readable labels.
- [ ] Check stability during workflow switching and change review. Avoid layouts where a small edit unnecessarily moves most of the map.
- [ ] Check performance, keyboard interaction, zoom/pan compatibility, licensing and local/private operation.
- [ ] Present visual examples and a recommendation: retain the current algorithm, reuse part of a tool, or replace a defined stage. Review the recommendation before integration.

**Finished when:** We have a clear visual and technical reason for the recommendation. A layout tool must preserve the supplied relationships; attractive placement is not evidence that a connection exists. This task does not add a new canvas level or require showing more boxes.

### I04 — Make AI generation measurable

- [ ] **I04 complete — We can assess the time, request usage and practical cost of generating explanations.**

**The problem today:** Selective generation and model configuration are delivered, but choosing a fast model is only part of making generation efficient. We need evidence of how much work a selected card causes, how long it takes, and how much caching or repair affects it.

**What we want:** A small, reproducible measurement process for one selected card and for full-project generation. Start with test/report data; do not assume the product needs a permanent usage dashboard.

**Example:** Generating one pricing explanation should report its draft/review/repair requests and elapsed time. Reopening unchanged code should demonstrate cache reuse. A selective request must not silently cause the remaining project cards to generate.

**Work checklist:**

- [ ] Measure elapsed time, provider request counts, repair/retry counts and cache reuse for representative requests.
- [ ] Record token usage when the provider supplies it. Mark missing usage or pricing as unavailable rather than inventing a cost.
- [ ] Compare selective and full generation using the same project and model configuration.
- [ ] Verify the boundary of a selective request, including supporting context and any already generated cards.
- [ ] Use the results to recommend concrete improvements. Review whether any user-facing measurement is useful before adding controls.

**Finished when:** We can explain the observed speed and usage of the existing generation modes with repeatable evidence. Basic selective/full generation remains complete under C05; this item covers the remaining measurement work.

### I05 — Recheck explanation quality under the current fast model settings

- [ ] **I05 complete — We have a current quality assessment beyond mocked pipeline tests.**

**The problem today:** The previous live explanation review identified factual problems and led to fixes. Since then, generation settings and structural evidence have changed. Browser tests using mock responses establish interaction behavior, but do not establish the factual quality of today's model output.

**What we want:** Compare generated explanations with independently checked expected behavior, using the current model profile. Keep this assessment separate from I04: a faster, cheaper explanation can still be misleading.

**Example:** A card must retain the four-seat discount threshold and distinguish charge-failure cleanup from pricing errors before seat reservation. A controller wrapper must not claim it performs every downstream check itself.

**Work checklist:**

- [ ] Reuse the reservation review rubric and add a small set of independent cases covering selected functions, grouped responsibilities and workflows.
- [ ] Assess omitted rules, invented behavior, incorrect ownership, failure boundaries and disagreements between related cards.
- [ ] Record the tested model/settings, context limitations and actual results. Treat old live-review results as historical evidence.
- [ ] Fix supported evidence/prompt/validation issues and add regression checks where meaningful.
- [ ] Decide explicitly whether any deeper review settings justify their extra time and usage; do not silently change the fast profile.

**Finished when:** We have a readable account of current strengths and failures, plus fixes or explicit limitations for important errors. Live provider calls require the applicable code-sharing authorization and should not be triggered just by editing this checklist. AI self-review is not a correctness proof.

### I06 — Bring documentation and uncertainty labels into line with current behavior

- [ ] **I06 complete — Current guidance accurately describes what the app does and what remains unknown.**

**The problem today:** Some earlier notes describe the old always-blocking generation flow or reasoning-enabled reviews. Coverage wording also says branch order is not modeled, although bounded paths now retain some source ordering. Such text can confuse users about both capabilities and limits.

**What we want:** Current documentation and visible evidence labels should agree with the implementation. Historical review records should retain their original findings with clear dates/context rather than appearing to describe the present configuration.

**Work checklist:**

- [ ] Audit README guidance, task notes, quality-review notes and coverage limitations for stale statements.
- [ ] Distinguish the current selective default from optional full blocking mode and document the actual fast thinking settings.
- [ ] Distinguish bounded source-path ordering from unresolved callback timing, scheduling and observed execution.
- [ ] Keep the differences between parsed facts, heuristic grouping, AI interpretation and unknown behavior understandable in existing details/help text.
- [ ] Correct mismatched action names and cross-links, and check any changed visible labels in the browser.

**Finished when:** Users can read current help and understand the same behavior they encounter in the app, without overstating analysis accuracy.

## New features discussed

### F01 — Let users correct inferred workflows and grouping

- [ ] **F01 complete — Users can make small, saved corrections when the inferred map is misleading.**

**The problem today:** The app guesses responsibility names, grouping and workflow entry points from code structure. Those guesses may not match how the project owner understands the system, and a user currently has no saved way to correct them.

**What the user should experience:** Make a focused correction from the existing workflow or details interface. For example, rename a workflow, choose a different existing entry operation, or adjust which responsibility owns an operation. Reopening that project should retain the correction. The exact controls need a minimal design review first.

**Example:** The app calls a workflow “Run,” but its real purpose is “Send booking confirmations.” The user renames it. Alternatively, the app chooses a demo wrapper as the entry, and the user selects the real existing handler instead. These changes affect presentation or discovery scope; they do not rewrite source code or manufacture call connections.

**Work checklist:**

- [ ] Agree which corrections belong in the first version and design the smallest usable interaction.
- [ ] Save corrections for the intended project and restore them on reopening.
- [ ] Distinguish user-corrected labels/grouping from automatically inferred ones, and provide a reset action.
- [ ] Recalculate workflow scope when the entry operation changes, using existing call evidence.
- [ ] If an operation is renamed or removed, show that its saved correction needs attention rather than silently applying it elsewhere.
- [ ] Verify that corrections do not leak into another project or mutate its source.

**Finished when:** A user can fix a misleading inference, reopen the project and see the same correction, with a clear way to return to automatic discovery.

### F02 — Follow one possible scenario through a workflow

- [ ] **F02 complete — Users can distinguish success, early-exit and failure paths without reading every branch together.**

**The problem today:** A workflow map contains calls from several possible outcomes. Seeing connections to Payment, Reservation and Storage does not mean every request visits all of them. Branches are described in details, but a user cannot select one outcome and follow its path visually.

**What the user should experience:** Choose a scenario for the current workflow and see the relevant steps highlighted in the existing map, with a short explanation of the condition that leads there. Other outcomes remain available to inspect. Scenario selection is a proposed interaction that needs review before implementation.

**Booking examples:**

- Success: calculate price → reserve seats → charge → save the booking.
- Duplicate request: find an existing booking → return it; skip another reservation and charge.
- Payment declined: reserve seats → charge fails → release seats → return an error.

These are possible paths inferred from the code. Choosing one does not run the project, charge a card, or prove that a production request took that path.

**Work checklist:**

- [ ] Design a compact way to choose a scenario without another canvas mode or a large control panel.
- [ ] Derive scenarios from available branch, return and exception evidence. Avoid inventing paths to make a complete-looking story.
- [ ] Show why the path applies, which steps may run and where it exits.
- [ ] Keep alternative paths discoverable and provide a return to the complete workflow.
- [ ] Explain where dynamic dispatch, loops or missing information prevent a reliable outline.
- [ ] Verify the three booking examples against executable fixtures and browser interactions.

**Finished when:** A user can explain why a duplicate request skips charging and why a payment failure releases seats, while understanding that the display is an inferred outline rather than a runtime trace.

### F03 — Animate the selected scenario accurately

- [ ] **F03 complete — Animation illustrates the chosen path instead of sweeping across every possible connection.**

**Depends on:** F02 and enough structural evidence to describe the chosen path.

**The problem today:** The existing animation illustrates call topology. Its visual order does not necessarily match the execution order of a particular success or failure case.

**What the user should experience:** When a scenario is selected, animation follows its applicable steps and stops at its outcome. On a duplicate request, it stops at the early return. On payment decline, it follows the failure cleanup and does not continue to saving a successful booking.

**Work checklist:**

- [ ] Use the scenario's path evidence to select animated boxes and connections.
- [ ] Respect early returns, thrown errors and cleanup boundaries.
- [ ] Avoid presenting a definite sequence where concurrency or unresolved dispatch makes ordering unknown.
- [ ] Keep the meaning of the highlight understandable with animation disabled, and honor reduced-motion preferences.
- [ ] Preserve the separation from commit playback so change animations and scenario animations do not compete.
- [ ] Verify success, duplicate-return and failure-cleanup behavior in the browser.

**Finished when:** Movement reinforces the selected scenario without suggesting that all dependencies execute or that the app recorded a real run. It should remain understandable as a static highlighted map.

## Deferred / parked

### D01 — Check the app against representative real projects

- [ ] **D01 complete — Common real-project failures have been found, fixed and covered by regression checks.**

**Status:** Skipped at the user's request. Do not start automatically.

**The problem to address later:** Small fixtures demonstrate specific rules, but real React, Node/Express and TypeScript projects combine aliases, callbacks, shared state, framework conventions and large dependency graphs. A map can work for the reservation example while missing important behavior elsewhere.

**What this task would do:** Analyze a small, representative collection of real projects whose behavior can be independently checked. Record missed workflows, incorrect connections, confusing responsibility groups and slow or unreadable maps. Fix the existing analysis/presentation problems found rather than adding controls for every edge case.

**Work checklist when resumed:**

- [ ] Select representative projects with a manageable scope and known expected behavior.
- [ ] Record concrete correct, missing and misleading findings, with enough source evidence to reproduce them.
- [ ] Fix the important issues and add regression fixtures.
- [ ] Test larger-map responsiveness, readable grouping and narrow-window interactions.
- [ ] Feed relevant findings into I02 and I03 so tool choices address real weaknesses.

**Finished when:** The chosen projects have documented coverage and their significant findings are resolved or explicitly reported as limitations. This does not mean the app supports every project.

### D02 — Make Git-history importing and updating smoother

- [ ] **D02 complete — Users can open and update repository history with a simple, predictable flow.**

**Status:** Git-import work remains parked. I01 is separate: it improves review of changes in history that has already been imported.

**The problem to address later:** The current flow requires exporting a history file and importing it into the app. A browser reload does not retrieve new commits. A repository URL alone also leaves questions about private access, branch choice and where repository data is stored.

**Possible experience:** Open a local repository, or optionally connect a repository URL. Show which repository and branch are being reviewed. A single Refresh action checks for new commits and makes them available without moving the user away from the commit they are inspecting. This is a proposal, not an implemented connection.

**Example:** A teammate pushes three commits while the user reviews an older change. Refresh should report three new commits and keep the current review in place. The user chooses when to inspect Latest. A failed update should leave the last usable history available.

**Work checklist when resumed:**

- [ ] Review the existing [Git-history import proposal](git-history-import.md) and decide whether local repositories or URLs come first.
- [ ] Decide how authentication, branch choice, repository storage and removal work without cluttering the app.
- [ ] Design the minimal import/Refresh interaction and its progress/error messages.
- [ ] Retrieve commit data without merging changes into the user's working branch.
- [ ] Preserve the selected workflow, review position and last good history; handle rewritten history explicitly.
- [ ] Decide the initial history range, treatment of large repositories, and whether/how earlier commits can be loaded within explicit resource limits.
- [ ] Verify no-change updates, new commits, authentication/network failures and changed ancestry.

**Finished when:** Opening and updating supported repositories is understandable and predictable, without a separate synchronization dashboard or unwanted changes to the user's checkout.

### D03 — Investigate unsupported project-resolution settings

- [ ] **D03 complete — The selected resolution gaps are supported or clearly documented with evidence.**

**Status:** Deferred analysis coverage work. Coordinate with I02 and D01 before writing more custom resolver logic.

**The problem:** The app understands local conventional compiler settings, but package-provided configurations, package export rules, custom compiler-config filenames and bundler-only aliases remain gaps. This can make a real internal call look unresolved even when the project builds successfully.

**Example:** A project imports through an alias defined only in its bundler configuration. The app must either understand the selected setting or explain that it cannot resolve it. It must not guess a target from a similar filename.

**Work checklist when resumed:**

- [ ] Collect minimal examples for package-provided settings, package exports, custom config names and bundler aliases.
- [ ] Determine which existing tooling can handle each case and which files the imported snapshot must contain.
- [ ] Prioritize cases based on actual projects rather than attempting every build system at once.
- [ ] Implement the selected support consistently for folder imports, explanation evidence and historical snapshots, or retain an explicit unresolved reason.
- [ ] Verify that configuration bodies do not become map boxes or leak into explanation/export source evidence.

**Finished when:** Each selected case resolves correctly or explains its unsupported boundary. Missing files, external packages and arbitrary build behavior must not be silently assumed.

### D04 — Investigate unresolved calls and framework-triggered behavior

- [ ] **D04 complete — Agreed additional call/entry patterns have evidence-based handling.**

**Status:** Deferred; specific patterns and frameworks are not yet selected. Prefer the findings from I02 and D01 over a broad promise of support.

**The problem:** Express discovery is delivered, but arbitrary dynamic dispatch, dependency injection, framework callbacks, implicit constructors/accessors, decorators and field-initialization timing are not reconstructed completely. An external implementation may also be absent from the imported snapshot.

**Example:** Passing a handler to a framework establishes a reference. It does not establish when it runs, how many times it runs, or that one registered middleware always invokes the next. Calling through a value selected at runtime may have several possible targets.

**Work checklist when resumed:**

- [ ] Select concrete patterns that matter in the projects being reviewed; identify which additional framework adapter, if any, is justified.
- [ ] Separate registration, possible dispatch targets, actual calls and external boundaries in the internal evidence.
- [ ] Add supported relationships only where there is sufficient evidence; keep unresolved alternatives visible.
- [ ] Preserve callback/implicit-operation distinctions in workflow focus, explanation context and history.
- [ ] Add regression examples including misleading cases that must not produce fabricated connections.

**Finished when:** The selected patterns improve coverage without turning uncertain behavior into a confirmed execution story. Runtime tracing, executing imported projects, and complete support for every framework/language are not approved features under this task.

### D05 — Extend bounded behavior paths and selective call expansion

- [ ] **D05 complete — Selected complex paths can be explained without overwhelming the map.**

**Status:** Deferred behavior-analysis work from the original execution-path/flow plan. Coordinate analysis choices with I02 and interaction design with F02/F03.

**The problem:** Current paths cover a useful subset of branches, returns and exception regions, but loops, switch statements, complex expressions and scheduling still have explicit limits. The earlier plan also proposed expanding a call to inspect its internal path; that interaction has not been delivered.

**Example:** A workflow delegates to a helper that retries an operation. Showing one unqualified arrow can hide the retry and its exit conditions. Conversely, expanding every helper automatically would bury the important workflow in implementation detail.

**Work checklist when resumed:**

- [ ] Select the next language/control-flow cases from real findings, including loops/switches where useful.
- [ ] Retain relevant conditions, exits, exception regions and await boundaries, with explicit limits on expansion.
- [ ] Keep concurrency and callback scheduling unknown where the source cannot establish an order; do not present a single invented sequence.
- [ ] Review a minimal optional interaction for expanding a selected call's behavior and returning to the higher-level path.
- [ ] Verify paths against executable fixtures, export/import compatibility and bounded explanation context.

**Finished when:** Users can inspect the selected additional cases with less ambiguity and controlled detail. This is not a commitment to full symbolic execution or exhaustive enumeration of every path.

### D06 — Decide what to do with the reserved Plan control

- [ ] **D06 complete — The placeholder has a clear product decision.**

**Status:** Unscoped placeholder, not an approved planning feature. Tracked because the current UI and README reserve a disabled Plan control.

**The problem:** A disabled future control suggests functionality without defining what it should help the user do.

**Work checklist when resumed:**

- [ ] Decide whether the control is useful to keep, should be removed to simplify the UI, or deserves a separate proposal.
- [ ] If a planning feature is proposed, define the user problem and review its scope before treating it as implementation work.

**Finished when:** The placeholder is intentionally retained or removed, or a separate reviewed specification exists. No Plan-mode implementation is authorized by this entry.

## Coverage of earlier plans and notes

This mapping makes omissions and overlaps easier to spot. New findings belong here rather than in a second competing backlog.

| Earlier pending area | Tracked task |
| --- | --- |
| Explain modified boxes at a high level, with structural before/after | I01 |
| Reuse established static-analysis tools | I02 |
| Graphify applicability and graph/layout tooling | I03 |
| Selective AI measurement and current-model factual quality | I04, I05 |
| Outdated guidance and analysis uncertainty wording | I06 |
| Saved entry/name/grouping corrections | F01 |
| Scenario selection and path-following animation | F02, F03 |
| Representative real-project coverage and map usability | D01 |
| Local/URL Git import, authentication/storage, branch selection, Refresh, large-history loading | D02 |
| Remaining compiler/package/bundler resolution gaps | D03 |
| Additional framework entry patterns, dynamic/implicit calls and callback boundaries | D04 |
| Richer control flow, concurrency limits and optional call expansion | D05 |
| Undefined Plan placeholder | D06 |

Known limitations are captured as investigations or deferred work, not automatically promised features. Deliberate boundaries—no raw-source/file-level UI and no claim that the app is a source of truth—remain product rules, not unfinished tasks.

## Delivered baseline

These items are complete and provide context for future work; their detailed implementation record is in [behavior-analysis-tasks.md](behavior-analysis-tasks.md).

- [x] **C01 — Project-aware resolution and explicit analysis coverage.** Compiler settings, aliases, dependencies, unresolved calls and supporting declarations.
- [x] **C02 — Responsibility-based component maps.** Group implementation by responsibility and fold supporting data/types into details; no file-level canvas.
- [x] **C03 — Operation-based workflows and Express entry discovery.** Separate sibling operations, preserve shared helpers and label uncertain registrations.
- [x] **C04 — Bounded structural behavior extraction.** Calculations, branches, early returns, await flags and scoped exception handling in existing cards/connections.
- [x] **C05 — Selective/full AI explanation modes and server-side model configuration.** Configurable model, endpoint, credentials, thinking/effort, budgets and timeouts.
- [x] **C06 — Workflow-scoped explanations and history continuity.** Exclude unrelated sibling operations; preserve review position on compatible history re-import.

Verification recorded for the last implementation pass: 173 automated tests, production build, and both Chrome browser suites passed. AI provider calls were mocked or blocked. This records the previous pass; it does not claim new tests were run for this documentation update.

## Progress log

- **2026-10-28:** Created this tracker before further implementation. Added updated-box before/after review, static-analysis tool evaluation and Graphify/layout evaluation. Retained workflow corrections and scenario exploration as planned new features. Real-project hardening and Git import remain parked. No integrations have been selected or implemented.

- **2026-10-28:** Expanded every pending task with the current problem, intended user experience, examples, work steps and a clear completion condition. Task IDs and deferred status are unchanged. Documentation only.

- **2026-10-28:** Consolidated remaining items from earlier plans, implementation limitations and review notes. Added AI measurement/quality, documentation alignment, resolution and dynamic-call gaps, richer paths/call expansion and the unscoped Plan-placeholder decision. Added source-area mapping; all previously deferred work remains deferred. No implementation or tool evaluation started.
