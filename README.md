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

- Switch between **System**, **Components**, and **Functions**. Each extracted named function has its own selectable node.
- System boxes group application areas (inferred from paths for imported projects). Components follow left-to-right dependency stages; functions remain individually selectable within component boundaries. Highlighting and inspection preserve positions; changing workflow focus or graph structure can reflow the layout.
- Select a workflow to focus its graph and collapse unrelated areas into a context box. Choose **All workflows** to restore the overview. Drag to pan and scroll to zoom.
- Hover or select a connection to trace its complete path and both endpoints while other paths fade.
- Selecting a workflow plays a one-pass, entry-to-end flow animation (illustrative, not a runtime trace). Reduced-motion preferences are respected.
- Try **Small change demo** (2 components) or **Large change demo** (13 components). Added nodes/connections are green, updated or affected ones amber, and removed ones pink and dashed. Reset restores the original sample.
- Use the **lock button** beside the zoom controls to keep the detail level fixed while zooming. The level tabs still work manually.
- Select a node to inspect inputs, outputs, decisions, and side effects.
- Click a connection in Components or Functions to inspect its purpose, calls, and callee inputs/results. Imported purposes are inferred; import-only dependencies are labeled as unknown. System connections are not selectable.
- Choose **Open project** to analyze a local JavaScript/TypeScript folder. Supported Chromium browsers can watch it for changes; other browsers import a snapshot.
- Optionally connect an OpenAI-compatible provider in settings for focused AI explanations. Its endpoint must allow browser requests (CORS).

## Scope and privacy

The included Commerce app and change demo are curated samples. Imported workflows and labels are inferred from static analysis, not verified runtime traces. Function edges show resolvable calls; dynamic dispatch, framework injection, path aliases, and anonymous callbacks are not fully supported. Tests, configuration, dependencies, and build outputs are excluded.

Imported source and API keys stay in browser memory. Selected implementation code is sent to your configured AI provider only when you submit a question. Refreshing clears the imported project and key. AI explanations may be inaccurate.

## Implementation

Vanilla JavaScript, Vite, Lucide icons, and the TypeScript compiler API. `src/main.js` contains the UI; `src/analyzer.js` extracts code structure; `src/camera.js` and `src/function-graph.js` handle graph navigation and function nodes. Automated tests live in `tests/`.
