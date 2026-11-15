# Glass Reach Harness — development notes

Player setup is maintained in [the quick-start](../QUICKSTART.md); feature and operational details are in [the main README](../README.md). These replace the earlier Field Companion notes.

## Run and test

From the repository root, with Node.js 22 or newer:

```sh
npm test
npm run demo
npm start
```

The Windows launchers open the browser and reuse an existing server. `npm start` runs the live server without automatically opening a browser. Demo mode is fictional and separate from live data. No project package installation or build step is required. Live transport uses Windows PowerShell and DPAPI; passing Linux CI does not imply Linux live-play support.

## Implementation map

| Files | Responsibility |
| --- | --- |
| `server.mjs`, `launch.mjs` | HTTP API, background work, startup and reuse |
| `store.mjs` | Local records, exports and restart recovery |
| `game.mjs`, `game-transport.ps1` | Serialized game operations and encrypted credentials |
| `agent.mjs`, `codex-path.mjs` | Isolated Codex App Server and executable discovery |
| `prompts.mjs`, `rules-feed.mjs`, `rules-ui.js` | Editable prompts, engine rules context and proposed prompt edits |
| `release-notes.mjs`, `../CHANGELOG.md` | Single-source installed-build release notes for GitHub and Rules & updates |
| `atlas.mjs`, `atlas-geometry.mjs`, `atlas-ui.js` | Per-world discovery, measured map geometry, camera, labels and visible-character overlay |
| `triggers.mjs`, `trigger-ui.js` | Shared watch/readied conditions and grouped trigger editor |
| `game-turn.mjs`, `readied.mjs`, `autopilot.mjs` | Manual sequences, exact readied commands and permission-checked autonomy |
| `story.mjs`, `storyboard.js`, `timeline.mjs` | Saved history, scenes, recaps and detailed-log grouping |
| `journal.mjs`, `people.mjs` | Quests, local records, observed documents and relationships |
| `index.html`, `style.css`, `dashboard.js` | Play interface, navigation and themes |

The `dashboard/` directory, `dashboard.js`, existing `gr-*` browser storage keys and `X-Glass-Reach-Dashboard` request header retain their technical names for compatibility. Product titles, launchers and release packaging use Glass Reach Harness. The old launcher filenames forward to the new ones.

## Verification boundaries

The test suite uses fictional fixtures and temporary data stores. It covers isolation, persistence, pagination, mode permissions, uncertain delivery, cancellation, bookmarks, rules synchronization and prompt revisions. It does not authenticate to the live game or charge for model calls. Engine mechanics and account-specific model availability still depend on the connected services.

Notification watches are in-memory and end with the server. Readied commands persist, while uncertain deliveries are not retried. Autopilot is paused after a restart. The rules-review workflow proposes text; it does not patch source code. Saved world rules do not automatically activate a new character sheet or expand an action allowlist.

Keep personal records, credentials and local historical handoff files out of commits. Public releases package tracked source only. See [private phone access](MOBILE.md) for the optional proxy configuration; localhost is the default.

## Maintaining release notes and the guide

Add concise player-facing bullets to the newest section of root `CHANGELOG.md` when behaviour changes. Use `##` headings for dated versions or Unreleased sections and `-` bullets for notes. The local `GET /api/harness-updates` endpoint parses that file; Rules & updates renders its sections safely as text. Do not maintain a second UI copy. Tag/release status must be accurate; do not label development work as a published release. The draft release workflow also uses this file.

Update the affected pages under `Documention/Guide`, plus README/QUICKSTART when navigation or setup changes. Engine rules remain a separate feed and prompt context source.
