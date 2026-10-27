# AI configuration

Edit `ai.config.json` in the project root. Restart the dev or preview server after changing settings, then reopen the project. The server reads this file; it is never imported by the browser.

## Explanation mode

Set `explanationMode` to one of:

| Value | Behavior |
| --- | --- |
| `selective` (default) | Open the map after local preparation. Select a component or function and choose Generate explanation. Area and workflow/overview summaries have the same control. Only requested cards are generated; the map stays usable. |
| `full` | Keep the preparation screen open until all overview, workflow, area, component, and function cards are ready. Approval starts the complete queue, with callees before callers where possible. |

Selecting a box alone never sends code. Selective generation includes relevant supporting code as context, but does not generate separate explanations for that code. Cached reviewed cards can be reused. Pause, resume, retry, and regeneration apply to requested work; they do not expand a selective request to the whole project.

The first selective request asks for project code-sharing approval. Subsequent boxes are sent only when you explicitly request them. Full mode asks for approval before generating the whole project. Importing a new project resets approval. Missing credentials leave the selective map available; full mode continues to require every card and offers configuration checks or cancellation.

## Model and generation settings

`provider.model` is the model used for drafts, accuracy reviews, and Ask AI follow-up questions. `provider.baseUrl` selects the DeepSeek-compatible Chat Completions server; `/chat/completions` is appended to this base. The default remains `deepseek-flash` at `https://api.deepseek.com`.

Each generation phase has its own settings:

| Section | Use |
| --- | --- |
| `draft` | Initial card generation. |
| `review` | Source-grounded accuracy review and bounded clarity repairs. |
| `followUp` | Explicit Ask AI questions. |

For each phase:

- `thinking`: `enabled` or `disabled`.
- `reasoningEffort`: `low`, `high`, or `max`; sent only when thinking is enabled.
- `maxTokens`: initial request budget.
- `retryMaxTokens`: budget after a truncated or malformed provider response; must be at least `maxTokens`.

These controls follow the [DeepSeek thinking-mode API](https://api-docs.deepseek.com/guides/thinking_mode/). The current fast profile disables thinking for drafts, reviews, and follow-up questions. Each phase has a 2,048-token budget, increasing to 4,096 on a truncated-output retry. Effort is set to low but is ignored while thinking is disabled. To restore deeper review, set review.thinking to enabled, review.reasoningEffort to high, review.maxTokens to 16384, and review.retryMaxTokens to 32768. Turning thinking off does not remove the separate accuracy-review pass. JSON card validation and bounded repairs still apply.

`timeouts.requestMs` limits each proxy request, including its one provider retry. `timeouts.cardMs` limits the complete browser draft/review/repair sequence. `timeouts.followUpMs` limits an Ask AI question in the browser. All values are milliseconds.

The server owns model, thinking, effort, token budgets, and provider credentials. Browser request fields cannot override them. Settings display a read-only summary in AI configuration.

## Credentials and private overrides

Use `ai.config.local.json` for credentials. It is ignored by Git and is an optional recursive overlay on `ai.config.json`. An empty private file has been created for this checkout; fresh checkouts can copy `ai.config.local.example.json`.

```json
{
  "provider": {
    "apiKey": "YOUR_API_KEY"
  }
}
```

The local file may also override model, mode, or phase settings without changing committed defaults. Unspecified settings come from `ai.config.json`.

A nonblank configured `provider.apiKey` takes precedence over `DEEPSEEK_API_KEY`. Existing server environment keys and ignored `.env` / `.env.local` credentials remain supported as a fallback. Set the model in JSON; the app's explicit `provider.model` takes precedence over legacy `DEEPSEEK_MODEL` settings. Never use `VITE_` for a secret.

Configuration JSON files are blocked over HTTP, including direct filesystem and raw-import URLs. Only whitelisted public settings and a credential-presence flag reach the browser. No credentials enter the client bundle, explanation cache, or history exports. Keep credentials out of committed `ai.config.json`.

## Caching and verification

Changing the endpoint, model, draft settings, or review settings changes the explanation-cache fingerprint. Switching selective/full mode or changing credentials does not discard otherwise reusable cards. Source/dependency revisions continue to invalidate affected cards.

Run `npm test` and `npm run build`. For browser checks, start the app and run:

```sh
npm run test:ai-ui -- http://127.0.0.1:5173/
```

The browser check uses installed Chrome by default (`PLAYWRIGHT_CHANNEL` can select another installed Playwright channel). It intercepts every AI request and uses temporary fixture code; no real provider calls or credentials are used. It checks selective component/function/area requests, map responsiveness, consent, cache reuse and settings invalidation, full blocking preparation, and missing-key behavior. Screenshots are written to ignored `test-results/`.
