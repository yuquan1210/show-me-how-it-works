# show-me-how-it-works

Understand AI-generated code through an interactive map of application logic—not raw source code or lengthy explanations.

## Run locally

Requires **Node.js 20+** and npm. The default selective mode opens imported projects without an AI key; generate explanations for individual boxes when needed. Full mode waits for all explanations before opening the canvas.

```sh
git clone git@github.com:yuquan1210/show-me-how-it-works.git
cd show-me-how-it-works
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/** (or the URL printed in the terminal if that port is busy). If you already have this repository, start in its directory and run the two npm commands.

```sh
npm test      # Run automated tests
npm run build # Build static files into dist/
```

## Explore the app

- Choose **Overview**, **Components**, or **Functions** in the top-right toolbar. Zoom only changes magnification within the chosen level. Extracted functions, explicit constructors, methods, and inline callbacks have selectable nodes. Components group implementation code by inferred responsibility. Shared state, types, and re-export files appear in component details as supporting data and declarations, with shared-use labels, rather than separate canvas boxes. Meaningful startup operations remain components. There is no file-level canvas view.
- Overview boxes group business areas (inferred from paths for imported projects). Components follow left-to-right dependency stages; functions remain individually selectable within component boundaries. Highlighting and inspection preserve positions; changing workflow focus or graph structure can reflow the layout.
- Select a workflow to focus its graph and collapse unrelated areas into a context box. Choose **All workflows** to restore the overview. Drag to pan and scroll to zoom.
- Hover or select a connection to trace its complete path and both endpoints while other paths fade.
- Selecting a workflow plays a one-pass, entry-to-end flow animation (illustrative, not a runtime trace). Reduced-motion preferences are respected.
- Select a node for a compact behavior card: **Receives**, **Checks & branches**, **Changes**, **Returns**, and **If it fails**. Missing evidence stays explicitly unknown.
- Click a connection in Components or Functions to inspect its purpose, expected information/results, side effects, and failure uncertainty. Destination inputs are not verified call arguments. Imported purposes are inferred; import-only dependencies are labeled as unknown. Overview connections are not selectable.
- Choose **Open project** to analyze a local JavaScript/TypeScript folder. Import reads a snapshot. The app does not watch uncommitted file changes.
- Choose **Analysis coverage** on the canvas, or **Review analysis coverage** on the full-mode preparation screen. The report separates mapped, external, and unresolved calls, lists dependency records and reasons, and filters by module. Details offer a function-scoped report. Locations are source references, not a raw-code viewer. Callback arguments are recorded separately; passing a callback does not prove it runs. Counts cover supported imported source, not excluded tests/build outputs or runtime test coverage. Try `examples/analysis-coverage` without an AI key in selective mode.
- AI explanations use DeepSeek through a local server endpoint. Settings show configuration status, never a key-entry prompt.

## Canvas workspace

The canvas fills the window. Workflows, commit history, and details float over it. Drag their headers to move them; resize workflow, history, and detail windows from the lower-right corner. Window sizes and positions are retained while you explore. Use the individual panel icons to hide or restore windows. The detail window keeps AI and structural analysis in matching tabs. Selected connections use a strong blue highlight. The current commit title belongs to the history window, away from graph nodes. Workflow lists use names rather than project-specific icons.

The compact Code / Plan control reserves space for future planning workflows. Plan is disabled and has no implementation yet. Architecture and live-change demos have been removed; system evolution is explored through Commit history. Imported history refreshes when you export and import a newer history file.

## Replay commit history

Open **Commit history** with the clock icon. No commit is selected initially, so the current canvas stays unchanged. Select a commit to show its workflow snapshot, then press **Play** to advance to the latest imported commit. Play without a selection starts at the first commit. Separate **Pause** and **Stop** icon buttons let you suspend playback or end it completely. Stop restores your previous workflow, detail level, and canvas position. Deselecting Commit history or closing its panel also stops it. Step backward/forward, or choose 4, 8, or 12 seconds per commit. Selecting a node or connection pauses playback for inspection.

The sample includes six **illustrative snapshots**, not real Git commits. Added boxes appear, modified boxes glow, and removed boxes fade but remain inspectable until the next commit. Connections animate too. Positions are reserved across the timeline, and reduced-motion preferences disable animations. Each commit is compared with its preceding commit, not with the last item you clicked.

Choose a workflow in the sidebar to scope the canvas and bottom timeline to it. The selection stays in place during playback. Enable **Skip unaffected commits** to jump over commits without mapped changes; the timeline reports how many were skipped. Removed or disconnected branches remain inspectable for their removal commit. Before creation and after removal, the canvas explains why the workflow is empty.

Changed dependencies without confirmed call-path evidence are labeled **May affect**. Stable identities and uniquely matching entry fingerprints track workflow moves; ambiguous matches or splits are flagged instead of silently merged. These are static structural comparisons, not verified runtime behavior. History playback suspends workflow data-flow animation so it does not compete with change animations.

For a real JavaScript/TypeScript repository, run this from the local app checkout (after `npm ci`):

```sh
node scripts/export-history.mjs /absolute/path/to/repo /absolute/path/to/project.history.json
```

Then choose **Import Git history** and select that file. The exporter reads **HEAD’s first-parent chain, oldest to newest**, without checking out commits or changing the repository. Merge commits are compared with their first parent; side branches are not replayed independently. Export again to include newer commits. Uncommitted changes are not included. Existing output files are never overwritten.

Exports contain graph summaries, paths, commit subjects, dates, and SHA-256 fingerprints—not source bodies. They may still contain private project information; keep them private. Import stays in browser memory. Limits: 5,000 commits / 80 MB. Unsupported files, tests, config and files larger than 600 KB are excluded. Parsing limitations still apply; this is structural evolution, not verified runtime behavior.

## DeepSeek explanations

Edit `ai.config.json` for explanation mode, provider endpoint/model, draft/review/follow-up thinking and reasoning effort, token budgets, and timeouts. Set `explanationMode` to `selective` (default) or `full`. Put `provider.apiKey` in ignored `ai.config.local.json`; existing `DEEPSEEK_API_KEY` environment or `.env` credentials remain a fallback. Copy `ai.config.local.example.json` for a fresh checkout. Restart the server after changes and reopen the project. Keys stay server-side, and configuration files are blocked over HTTP. See [AI configuration](docs/ai-configuration.md) for fields, precedence, caching, and checks.

In selective mode, open a local project, select a box, and choose **Generate explanation**. The first request asks for project code-sharing approval. Only explicitly requested cards are generated; supporting source is supplied as context without generating its cards. The canvas remains usable during generation and errors. Cached cards are reused, and requested work supports pause, resume, retry, and regeneration. Area and overview/workflow summaries offer the same per-card control. The local proxy works with `npm run dev` and `npx vite preview --host 127.0.0.1` after building. Static hosting alone needs its own server integration and secret. The proxy rejects non-local hosts and cross-origin requests.

In full mode, opening a project displays a blocking preparation screen. After approval, progress tracks all overview, workflow, area, component and function explanations. The canvas opens only when every card is ready; failed, missing or outdated cards do not count as complete. Pause/resume, retry and cancel are available. Fully cached projects open without new requests in either mode. Completion means structured cards are filled, not that claims are factually verified. Reopen a project to import a new snapshot. File enumeration order does not invalidate explanations.

Uncached cards are drafted and reviewed against source. The current fast profile uses deepseek-flash with thinking disabled for drafts, reviews, and follow-up questions, with a 2,048-token budget (4,096 on a truncated-output retry). The separate review pass remains, with less reasoning depth than the previous high-thinking profile. Request and card timeouts remain configurable. Full mode prepares callees before callers where possible. Selective mode generates only the requested card, with supporting source and any already cached reviewed summaries. Progress distinguishes generation, accuracy review, and clarity repair. Normally each card uses two provider requests, with bounded repairs. Only final cards are displayed; provider reasoning stays server-side. Model, endpoint, generation-policy, and source-context changes invalidate affected cache entries; switching modes preserves reusable cards. Short fields are limited to 24 words. Consequential branches, effects, returns, and failures target at most 32 words, with a 40-word safety limit. Context distinguishes selected code from supporting callees and includes module state, types, and parser-derived facts. Selected arithmetic values and direct text normalization must be retained in function cards. These checks improve coverage but do not prove semantic correctness.

The canvas uses each ready AI card's purpose as its box subtitle. Detail headings are compact, and follow-up questions are collapsed under **Ask AI**, leaving more room for the matching AI / Structural analysis fields.

A comment-free TypeScript sample is available in `examples/ticket-reservations`. Open that folder to test generation. Its README lists expected behavior separately from the source, so those answers are not included in the analysis context.

Generated text and revision hashes are cached on this device (up to 500 cards); raw code and API keys are not cached. Reopening unchanged code reuses cards. Changes to supplied dependency context invalidate the cache when you reopen a project. Use settings to clear the cache. Opening an updated project requires approval before any uncached explanations are generated. There is no live file watcher.

Explanations are AI inferences, not verified execution. Context is bounded, so large components and complex dependencies may be incomplete. Server connectivity and provider errors surface recoverable messages. Commit-history snapshots and the curated demo do not trigger background AI analysis. Real API access requires a configured server key and provider balance; automated tests use mock responses.

## Scope and privacy

Project import also reads `tsconfig.json`, `jsconfig.json`, and their conventionally named variants as local analysis metadata. The nearest root or nested config supplies `baseUrl`, `paths`, and module-resolution settings; relative local `extends` chains work when the inherited files are included in the snapshot. Solution-style references select a uniquely matching referenced configuration using its include/exclude/files membership. Missing, circular, or overlapping references produce warnings instead of silently choosing an arbitrary project. These settings resolve component dependencies, function calls, and supporting type/state context consistently. Configuration files do not become graph components, and their bodies are not sent for AI explanations or included in history exports. Missing or invalid settings produce a **Check project settings** action on the canvas and appear in the coverage report. Package-provided configs, package exports, custom config filenames, and bundler-only aliases are not supported yet. Config include/exclude/files settings select referenced settings but do not hide supported files from the chosen folder snapshot. See the [implementation tasks and review notes](docs/behavior-analysis-tasks.md).

Re-export chains, type-only dependencies, literal dynamic imports, and unshadowed literal `require` dependencies are recorded explicitly. Computed module locations and call targets stay unresolved. Component connections pass through supporting re-export files to the responsibilities they expose. Sharing a type or value does not invent a call between its consumers. Grouping uses domain folders or names with technical suffixes removed, so it remains an inference rather than verified business ownership. Unowned supporting declarations appear together as Shared data & definitions. AI component cards cover the component's implementation and supporting context; supporting files do not require separate visible cards. Explicit constructors and overload implementations are mapped where their bodies can be resolved; implicit accessor invocation, implicit constructors, framework injection, and callback timing are not reconstructed. External package bodies are not loaded. Coverage metadata survives Git-history export; old history files without coverage remain supported. Exports omit module source and function bodies, and imported history cannot supply explanation source evidence. AI context includes bounded dependency and uncertainty records, and changed supporting evidence invalidates cached cards.

The included Commerce app and commit snapshots are curated samples. Imported workflows and labels are inferred from static analysis, not verified runtime traces. Function edges show resolvable calls; dynamic dispatch, framework injection, and anonymous callbacks are not fully supported. Tests, dependencies, and build outputs are excluded; compiler configuration is read only as analysis metadata.

Imported source stays in browser memory until you approve background analysis or submit a question, when selected context passes through the local server to DeepSeek. The API key stays in the server environment. Refreshing clears the imported project, but locally cached explanation text remains until cleared. AI explanations may be inaccurate.

The UI has no raw-source or pseudocode view. Source is used internally for analysis only. AI answers must be structured plain-language cards; malformed responses are rejected and code-like content is withheld. These safeguards are not a semantic proof of arbitrary provider output. All inferred explanations remain labeled as unverified.

## Implementation

Vanilla JavaScript, Vite, Lucide icons, and the TypeScript compiler API. `src/main.js` contains the UI; `src/analyzer.js` extracts code structure; `src/camera.js` and `src/function-graph.js` handle graph navigation and function nodes. Automated tests live in `tests/`.
