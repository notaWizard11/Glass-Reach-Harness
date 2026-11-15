# Glass Reach Harness

A player-controlled agent harness for **The Glass Reach**, built around Codex. It connects your character's goals, game rules, memories and actions through a persistent play interface.

**[Quick start: download, connect and play](QUICKSTART.md)** · [Changelog](CHANGELOG.md) · [Development notes](dashboard/README.md)

Early preview software. Live play currently requires Windows; fictional demo mode needs Node.js 22 or newer. No project dependency installation or build step is required.

## What the harness does

- Keeps a searchable game record, a scene-based storyboard and concise catch-up briefings. Explicit Away/Active bookmarks define an absence even while the game stays live.
- Separates private **Inner thoughts** from **Act in game**. Game requests execute one step at a time using fresh observations and confirmed results.
- Provides Atlas connections and schematic diagrams, character stats and inventory, people and relationships, quests, and a journal of notes, memories and observed documents.
- Supports notification watches, exact pre-approved readied actions and opt-in autopilot with goals, permissions and limits.
- Fetches the engine's rules changelog and supplies it to Codex. Rules reviews propose prompt changes for you to apply or dismiss.
- Exposes nine editable Codex query prompts in **Settings → Master Prompts List**, with context controls, saved versions and combined-instruction previews. Models can be selected per purpose.

The harness does not grant your character abilities or knowledge that the game has not provided. Atlas diagrams are schematic. Inventory Ready/backpack grouping is local organization, not an engine equipment-slot system. The current Character screen renders legacy Body/Wits/Will, skills and progression; the engine's newer sheet system is not yet a dedicated twelve-attribute UI. Rules context does distinguish whether the selected character has a sheet.

## Requests, context and permissions

**Inner thoughts** discusses possibilities without dispatching game actions. Explicit requests can save local quests, memories and notes. **Act in game** authorizes the requested sequence, including inspection between steps. It stops on refusal, uncertain delivery, Stop, or a 12-step limit. Stop cannot undo an already submitted action, and uncertain actions are not automatically retried.

Each Codex request uses a fresh temporary session populated by the harness. The shared Master prompt, character preferences, query-specific instructions and applicable engine rules are supplied again. Direct requests normally include the current observation, 60 recent events, 16 recent messages, relevant history matches and local records; the optional context counts and record groups are configurable. Scene writing, catch-up, quest discovery and rules reviews instead receive selected evidence batches. The harness owns the durable conversation and game history; it does not send messages into an existing desktop chat.

Shell, browser and external MCP execution are disabled in the harness's Codex process. Structured decisions are validated and dispatched by the local server. Editable prompts do not expand execution permissions. Rules reviews use the Inner thoughts model and never apply their proposals automatically. Downloading rules acknowledges them to the engine; **Mark updates seen** is a separate local reading marker.

## Background operation and usage

The server normally checks live game history every five seconds while Live is enabled, including with the browser tab hidden. Requests are serialized and a long request or foreground response can delay a check. Browsers may defer rendering until you return. Keep the server running and the PC awake.

Turning off Live pauses ordinary feed polling, not all background activity: armed readied actions, active autopilot and explicit watches have their own work. Notification watches are held in memory and must be set again after a server restart. Saved readied actions remain armed until triggered, expired or disarmed; interrupted deliveries are not retried automatically. Autopilot always restarts paused and requires an explicit start.

Autopilot checks its goals on the chosen interval, with an independent model, allowed action categories, optional location restrictions, duration and action/decision caps. Each decision can use Codex even when it chooses to wait. Manual messages and game actions pause it. Self-defence requires a recent recorded attack from the specific target; finishing blows and following are excluded. The game's own idle survival routines remain separate.

Game polling and rules downloads do not use model tokens. Replies, recaps, Auto prose, quest discovery, rules reviews and autopilot decisions do. Auto prose runs for loaded scenes while the browser tab is visible and Storyboard mode is selected. In the current build it can continue when you open another harness section; switch Auto prose off to stop those automatic requests. Evidence references and the detailed log remain available alongside generated text. The harness can only summarize records the game exposed and it saved.

Optional **Atlas → Illustrate a scene** uses the OpenAI Images API. Set `OPENAI_API_KEY` in the server environment and restart to enable it. This is separate API usage and billing from Codex sign-in; no image API key is needed for ordinary play.

## Local data and updating

Records and encrypted game tokens live in `.glassreach-data/live/`; demo records use `.glassreach-data/demo/`. Back up these folders privately. Windows DPAPI tokens only decrypt under the Windows account that saved them. Browser caches also contain observations and drafts; JSON exports contain campaign records and should be reviewed before sharing.

To update a downloaded copy: stop the running server, back up `.glassreach-data`, then replace the source files with the latest download while keeping that data folder. Relaunch **Open Glass Reach Harness.cmd** and refresh the browser. Git users can update their checkout with the server stopped. Existing **Open Glass Reach Dashboard.cmd** and **Open Glass Reach Demo.cmd** shortcuts continue to work. Internal `dashboard/` paths and the existing local-data format remain compatible.

The server listens on localhost by default at `http://127.0.0.1:47381/`. Opening the launcher again reuses a running harness. Responsive layout and browser installation do not provide remote connectivity; [private phone access](dashboard/MOBILE.md) is a separate, optional setup.

## Development and releases

Run from the repository root:

```sh
npm test
npm run demo
```

Tests use fictional data and temporary stores. CI runs them on Windows and Linux; live game credentials and real Codex access are not part of CI. Windows is required by the current live transport and credential protection.

A version tag such as `v0.1.0` runs the release workflow, which packages tracked source as `glass-reach-harness.zip` and creates a **draft** GitHub release. Publishing the draft is a separate step. Private local data is excluded from tracked source.

This is an independent project, not an official Glass Reach or OpenAI distribution. No open-source license has been selected; public visibility alone does not grant a general reuse license.
