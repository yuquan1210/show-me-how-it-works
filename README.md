# show-me-how-it-works

Understand AI-generated code through an interactive map of application logic—not raw source code or lengthy explanations.

## Run locally

Requires **Node.js 20+** and npm. No API key is needed to explore the sample or analyze a local project.

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

- Choose **Overview**, **Components**, or **Functions** in the top-right toolbar. Zoom only changes magnification within the chosen level. Each extracted named function has its own selectable node.
- Overview boxes group business areas (inferred from paths for imported projects). Components follow left-to-right dependency stages; functions remain individually selectable within component boundaries. Highlighting and inspection preserve positions; changing workflow focus or graph structure can reflow the layout.
- Select a workflow to focus its graph and collapse unrelated areas into a context box. Choose **All workflows** to restore the overview. Drag to pan and scroll to zoom.
- Hover or select a connection to trace its complete path and both endpoints while other paths fade.
- Selecting a workflow plays a one-pass, entry-to-end flow animation (illustrative, not a runtime trace). Reduced-motion preferences are respected.
- Select a node for a compact behavior card: **Receives**, **Checks & branches**, **Changes**, **Returns**, and **If it fails**. Missing evidence stays explicitly unknown.
- Click a connection in Components or Functions to inspect its purpose, expected information/results, side effects, and failure uncertainty. Destination inputs are not verified call arguments. Imported purposes are inferred; import-only dependencies are labeled as unknown. Overview connections are not selectable.
- Choose **Open project** to analyze a local JavaScript/TypeScript folder. Import reads a snapshot. The app does not watch uncommitted file changes.
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

Set `DEEPSEEK_API_KEY` in the environment of the process running `npm run dev`, or in an ignored `.env.local` file, and restart the app. Optionally set `DEEPSEEK_MODEL` (default: `deepseek-flash`). See `.env.example`. Do not use a `VITE_` prefix for secrets: the key stays server-side and is never bundled or returned to the browser. AI settings show whether a key is configured; a missing key displays an explanatory message without prompting for entry.

Open a local JavaScript/TypeScript project, choose **Generate explanations**, and approve sending this project's core implementation and dependency context to DeepSeek. The local proxy works with `npm run dev` and `npx vite preview --host 127.0.0.1` after building. Static hosting alone cannot access your machine's environment; a future hosted deployment needs its own authenticated server integration and server secret. The proxy intentionally rejects non-local hosts and cross-origin requests.

Opening a project displays a blocking preparation screen. After code-sharing approval, a progress bar tracks all overview, workflow, area, component and function explanations. The canvas opens only when every card is ready; failed, missing or outdated cards do not count as complete. Pause/resume, retry and cancel are available. Fully cached projects open without new requests. Completion means structured explanations are filled, not that AI claims are factually verified. Reopen a project to import a new snapshot. File enumeration order does not invalidate explanations.

Uncached cards are drafted, then reviewed against source using DeepSeek thinking mode with high reasoning effort at every level. Callees are prepared before callers when possible; higher-level reviews combine those function descriptions with source. Quality takes priority over latency: reviews have a 16,384-token budget (32,768 on a truncated-output retry), requests allow five minutes, and the complete draft/review/repair sequence allows twenty minutes per card. Progress distinguishes generation, accuracy review, and any clarity repair. This normally uses two provider requests per card, with bounded repairs if needed, so the first import takes longer and uses more tokens. Only the final card is displayed; provider reasoning is never sent to the browser. Changing the generation policy invalidates previous cached cards so reopening generates high-effort explanations. Short fields are limited to 24 words. Consequential branches, effects, returns, and failures target at most 32 words, with a 40-word safety limit so a few extra necessary words do not block opening a project. The context distinguishes selected code from supporting callees and includes module state, types, and parser-derived branch facts. Selected arithmetic constants and direct text normalization must be retained in function cards. These checks improve coverage but do not prove semantic correctness; minor AI imperfections remain possible.

The canvas uses each ready AI card's purpose as its box subtitle. Detail headings are compact, and follow-up questions are collapsed under **Ask AI**, leaving more room for the matching AI / Structural analysis fields.

A comment-free TypeScript sample is available in `examples/ticket-reservations`. Open that folder to test generation. Its README lists expected behavior separately from the source, so those answers are not included in the analysis context.

Generated text and revision hashes are cached on this device (up to 500 cards); raw code and API keys are not cached. Reopening unchanged code reuses cards. Changes to supplied dependency context invalidate the cache when you reopen a project. Use settings to clear the cache. Opening an updated project requires approval before any uncached explanations are generated. There is no live file watcher.

Explanations are AI inferences, not verified execution. Context is bounded, so large components and complex dependencies may be incomplete. Server connectivity and provider errors surface recoverable messages. Commit-history snapshots and the curated demo do not trigger background AI analysis. Real API access requires a configured server key and provider balance; automated tests use mock responses.

## Scope and privacy

The included Commerce app and commit snapshots are curated samples. Imported workflows and labels are inferred from static analysis, not verified runtime traces. Function edges show resolvable calls; dynamic dispatch, framework injection, path aliases, and anonymous callbacks are not fully supported. Tests, configuration, dependencies, and build outputs are excluded.

Imported source stays in browser memory until you approve background analysis or submit a question, when selected context passes through the local server to DeepSeek. The API key stays in the server environment. Refreshing clears the imported project, but locally cached explanation text remains until cleared. AI explanations may be inaccurate.

The UI has no raw-source or pseudocode view. Source is used internally for analysis only. AI answers must be structured plain-language cards; malformed responses are rejected and code-like content is withheld. These safeguards are not a semantic proof of arbitrary provider output. All inferred explanations remain labeled as unverified.

## Implementation

Vanilla JavaScript, Vite, Lucide icons, and the TypeScript compiler API. `src/main.js` contains the UI; `src/analyzer.js` extracts code structure; `src/camera.js` and `src/function-graph.js` handle graph navigation and function nodes. Automated tests live in `tests/`.
