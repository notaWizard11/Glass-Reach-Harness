# Glass Reach Dashboard

A local browser dashboard for **The Glass Reach**, with a Codex conversation, character records, a branching connections map, an atlas, and RPG inventory views. Early preview software; the live game integration is evolving.

## Try the fictional demo

Install Node.js 22 or newer, download/extract this repository, and run:

```sh
npm run demo
```

Open http://127.0.0.1:47382/. On Windows, you can instead double-click **Open Glass Reach Demo.cmd**. No npm dependencies, game account, or Codex sign-in are needed for the demo. Demo replies are scripted; Act in game demonstrates a single fictional speech action rather than interpreting arbitrary instructions.

## Connect to the game

Live operation requires Windows, Node.js, a locally installed and signed-in Codex CLI, and your own game access token. No credentials or saved campaign records are distributed here.

1. Run **Open Glass Reach Dashboard.cmd** or `npm start`, then open http://127.0.0.1:47381/.
2. Choose **+ Character**. Enter a profile name, your existing character ID, and your game token. The token is protected with Windows DPAPI on this PC. For a new character, leave the ID empty and use the templates available to your game grant.
3. In **Agent settings**, use **Reconnect selected character** to join that seat, then **Connect / check Codex**.
4. Save your master prompt and character-specific preferences. Use the composer to play.

The first empty Player profile is a setup placeholder. Profiles sharing a token share a single active game seat. Reconnect explicitly when switching seats. Separate profiles retain their own conversations, observations, maps, notes and suggestions.

The dashboard owns its Codex conversation; it does not inherit an existing Codex desktop chat. If the CLI is not on PATH, set `GLASS_REACH_CODEX` to its executable. Codex uses its existing local sign-in.

## Message modes

- **Talk to Codex:** questions, discussion and planning. It never executes game actions. Proposed actions can be reviewed separately.
- **Act in game:** describe actions and dialogue naturally. Sending authorizes the requested sequence. The agent chooses one step at a time, using fresh observations and previous results. It can inspect objects between actions. It stops on a refusal, uncertain delivery, Stop, or a 12-step limit.

Stop prevents subsequent steps; it cannot undo an action already sent. Interrupted or uncertain actions are never automatically retried. Unsolicited and autopilot suggestions always remain approval-only.

## Features

- Live dialogue, movement, combat, check and item events, with searchable saved history.
- Connections centered on the current location, including branches and loops.
- Saved schematic atlas diagrams and SVG export; these are not authoritative geographical maps.
- Reported character properties, skills, conditions and progression.
- Ready/backpack organization, item details and contextual actions. Grouping is personal organization, not an engine equipment command.
- Relationships, memories, goals, documents and local notes.
- Versioned master prompt, conversation reset/archive, character exports and persistent drafts.
- Arrival/reply/water/dusk watches while the server is running.
- Responsive layout and an installable browser shell where supported.

## Local data and privacy

Live records are stored in `.glassreach-data/live/`; demo records use `.glassreach-data/demo/`. Back up these folders privately. DPAPI credentials only decrypt under the Windows account that saved them. The browser also caches observations and drafts. Exports contain campaign records and should be reviewed before sharing.

The server listens on loopback. No public hosting is configured. The PC must remain awake for live game access, Codex replies and watches. A phone-sized layout does not itself provide remote access.

Codex receives the selected character's observations, recent events, local notes, prompt settings and recent conversation. Shell/browser/external MCP execution is disabled in its companion process. It returns structured decisions; the local backend validates and dispatches supported game operations. Game text is untrusted input, and model decisions can be mistaken—review results while playing.

## Development

```sh
npm test
```

Tests use fictional data and temporary stores. They cover persistence, event pagination, origin/CSRF checks, character isolation, concurrent approvals, stale proposals, restart recovery, the two message modes, sequential execution, refusal/uncertainty and cancellation. Real Codex replies and game-mode decisions have additionally been checked against fictional state; these checks are not part of CI.

Main files: `dashboard/server.mjs` (HTTP), `store.mjs` (records), `game.mjs` and `game-transport.ps1` (game connection), `agent.mjs` (Codex), `game-turn.mjs` (authorized sequences), and `index.html` / `style.css` / `dashboard.js` (UI).

## Updates and releases

CI runs the tests on Windows and Linux. Use branches and pull requests for changes, and record notable changes in CHANGELOG.md. Pushing a version tag such as `v0.1.0` runs tests and creates a **draft** GitHub release with a source ZIP. Review the draft before publishing it. Release ZIPs are generated from tracked files only; local credentials and saved records are excluded.

This is an independent companion project, not an official game or OpenAI distribution. No open-source license has been selected yet; public visibility alone does not grant a general reuse license.
