# Smoother Git-history import

Recommendation: keep the current local-history workflow as the default for now. A repository URL can be useful later as an optional entry point, but it does not by itself solve private access, branch selection, source storage, or refresh. Adding it now would introduce a connector and more UI, outside this pass's improvement-only scope.

## Improve the existing path

The exporter reads the current local HEAD. Re-export after the local branch changes, then use the existing Import Git history action. Use a new output filename because the exporter deliberately does not overwrite files.

This pass improves repeated import: if the new file extends the same named branch's complete commit sequence, preserve the selected commit and workflow and pause playback. Report how many commits became available. Do not jump the user to Latest midway through review. Re-importing an unchanged file confirms it is up to date. Rewrites, shortened histories, different branches, or unrelated projects start a fresh review.

A browser page reload clears the in-memory project. It is not a repository refresh. A URL pasted into the current JSON file importer would not work.

## A future minimal connection flow

Keep one Open project action with a local repository as the default. A URL option would create a separate app-owned repository cache, show its repository and branch, and use the user's configured Git authentication. Never embed credentials in a URL, export, log, or browser storage. Do not ask the user to manage a second working checkout.

A single Refresh action in the existing history toolbar is a reasonable solution once there is a connected repository. It should mean “check the selected repository branch for newer commits,” show progress/errors in place, and retain the current review. Show the last imported commit and time beside the existing history source. No polling, notifications or separate sync dashboard is necessary initially.

The operation should fetch the selected branch into the app-owned cache and read its new tip. It should not pull into a user's working branch. Git documents [fetch](https://git-scm.com/docs/git-fetch) as retrieving objects and refs; [pull](https://git-scm.com/docs/git-pull) also integrates changes into the current branch. Integration is unnecessary for a code-review viewer. Merely fetching and then exporting a stale local HEAD would also miss the new remote commits: analysis must explicitly use the fetched branch tip.

Refresh must preserve the last good import on authentication, network, parse, or size-limit failure. With no changes, show “Up to date.” With new commits, append the timeline and show the count; let the user choose Latest. With a force push or changed ancestry, clearly start a new history review rather than silently appending incompatible commits.

## Decisions requiring review

- Local-only connection first, or include URLs and authentication from the start?
- Which branch is imported, and how should the user switch branches without clutter?
- Where is the app-owned repository cache stored, and how is it removed?
- How large a history should be analyzed initially, and how should earlier commits load?

These are design proposals. This pass does not add URL cloning, remote access, a refresh button, authentication, background monitoring, or changes to a user's repository. No network Git commands were run.
