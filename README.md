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

- Zoom through **Overview**, **Components**, and **Functions**. Each extracted named function has its own selectable node.
- Overview boxes group business areas (inferred from paths for imported projects). Components follow left-to-right dependency stages; functions remain individually selectable within component boundaries. Highlighting and inspection preserve positions; changing workflow focus or graph structure can reflow the layout.
- Open **Architecture** separately for application, data-store, and external-system boundaries. Zoom only magnifies this view. Select a boundary to inspect its members or explore its components. This is C4-inspired, not a strict C4 implementation. The sample maps its backend, database, and providers; it does not include a frontend. Local imports use explicit frontend/backend folder-name hints; unclear ownership stays unassigned, and external dependencies are not invented.
- Select a workflow to focus its graph and collapse unrelated areas into a context box. Choose **All workflows** to restore the overview. Drag to pan and scroll to zoom.
- Hover or select a connection to trace its complete path and both endpoints while other paths fade.
- Selecting a workflow plays a one-pass, entry-to-end flow animation (illustrative, not a runtime trace). Reduced-motion preferences are respected.
- Try **Small change demo** (2 components) or **Large change demo** (13 components). Added nodes/connections are green, updated or affected ones amber, and removed ones pink and dashed. Reset restores the original sample.
- Use the **lock button** beside the zoom controls to keep the detail level fixed while zooming. The level tabs still work manually.
- Select a node for a compact behavior card: **Receives**, **Checks & branches**, **Changes**, **Returns**, and **If it fails**. Missing evidence stays explicitly unknown.
- Click a connection in Components or Functions to inspect its purpose, expected information/results, side effects, and failure uncertainty. Destination inputs are not verified call arguments. Imported purposes are inferred; import-only dependencies are labeled as unknown. Overview and Architecture connections are not selectable.
- Choose **Open project** to analyze a local JavaScript/TypeScript folder. Supported Chromium browsers can watch it for changes; other browsers import a snapshot.
- Optionally connect an OpenAI-compatible provider in settings for focused AI explanations. Its endpoint must allow browser requests (CORS).

## Replay commit history

Open **Commit history** in the sidebar. Select any commit, then **Play from this commit** to advance to the latest imported commit. Pause at any time, step backward/forward, or choose 4, 8, or 12 seconds per commit. Selecting a node or connection pauses playback for inspection.

The sample includes six **illustrative snapshots**, not real Git commits. Added boxes appear, modified boxes glow, and removed boxes fade but remain inspectable until the next commit. Connections animate too. Positions are reserved across the timeline, and reduced-motion preferences disable animations. Each commit is compared with its preceding commit, not with the last item you clicked.

Choose a workflow in the sidebar to scope the canvas and bottom timeline to it. The selection stays in place during playback. Enable **Skip unaffected commits** to jump over commits without mapped changes; the timeline reports how many were skipped. Removed or disconnected branches remain inspectable for their removal commit. Before creation and after removal, the canvas explains why the workflow is empty.

Changed dependencies without confirmed call-path evidence are labeled **May affect**. Stable identities and uniquely matching entry fingerprints track workflow moves; ambiguous matches or splits are flagged instead of silently merged. These are static structural comparisons, not verified runtime behavior. History playback suspends workflow data-flow animation so it does not compete with change animations.

For a real JavaScript/TypeScript repository, run this from the local app checkout (after `npm ci`):

```sh
node scripts/export-history.mjs /absolute/path/to/repo /absolute/path/to/project.history.json
```

Then choose **Import Git history** and select that file. The exporter reads **HEAD’s first-parent chain, oldest to newest**, without checking out commits or changing the repository. Merge commits are compared with their first parent; side branches are not replayed independently. Export again to include newer commits. Uncommitted changes are not included. Existing output files are never overwritten.

Exports contain graph summaries, paths, commit subjects, dates, and SHA-256 fingerprints—not source bodies. They may still contain private project information; keep them private. Import stays in browser memory. Limits: 5,000 commits / 80 MB. Unsupported files, tests, config and files larger than 600 KB are excluded. Parsing limitations still apply; this is structural evolution, not verified runtime behavior.

## Scope and privacy

The included Commerce app and change demo are curated samples. Imported workflows and labels are inferred from static analysis, not verified runtime traces. Function edges show resolvable calls; dynamic dispatch, framework injection, path aliases, and anonymous callbacks are not fully supported. Tests, configuration, dependencies, and build outputs are excluded.

Imported source and API keys stay in browser memory. Selected implementation code is sent to your configured AI provider only when you submit a question. Refreshing clears the imported project and key. AI explanations may be inaccurate.

The UI has no raw-source or pseudocode view. Source is used internally for analysis only. AI answers must be structured plain-language cards; malformed responses are rejected and code-like content is withheld. These safeguards are not a semantic proof of arbitrary provider output. All inferred explanations remain labeled as unverified.

## Implementation

Vanilla JavaScript, Vite, Lucide icons, and the TypeScript compiler API. `src/main.js` contains the UI; `src/analyzer.js` extracts code structure; `src/camera.js` and `src/function-graph.js` handle graph navigation and function nodes. Automated tests live in `tests/`.
