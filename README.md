# Glass Reach Dashboard

A local browser dashboard for **The Glass Reach**, with a Codex conversation, character records, a branching connections map, an atlas, and RPG inventory views. Early preview software; the live game integration is evolving.

## Quick start: from download to playing (Windows)

**You need:** a Windows PC, a Codex account with access, and your own Glass Reach **game token** and **character ID**. Get the token from whoever provided your game access. If you already play through an agent, ask it for your character ID. These are not your ChatGPT password or an OpenAI API key.

### 1. Download the dashboard

On this GitHub page, click the green **Code** button → **Download ZIP**. Right-click the downloaded ZIP → **Extract All**, then open the extracted folder. No GitHub account or Git installation is needed.

### 2. Check the one-time requirements

Install [Node.js LTS for Windows](https://nodejs.org/en/download) (version 22 or newer) with the default options if it is not already installed.

The dashboard needs **Codex CLI**, the command-line version of Codex. Having the desktop app alone does not guarantee this connection is ready. Open **Start → Command Prompt** and enter:

```text
codex --version
codex login status
```

If `codex` is not recognized, follow the **Windows** tab in the [official Codex CLI installation guide](https://learn.chatgpt.com/docs/codex/cli), then open a new Command Prompt. If it is not signed in, run `codex login` and complete the browser sign-in with your usual account. [Official sign-in help](https://learn.chatgpt.com/docs/auth).

**No dashboard plugin or separate OpenAI API key is needed for this sign-in route.**

### 3. Open the dashboard

Double-click **Open Glass Reach Dashboard.cmd** in the extracted folder. Keep its terminal window open while playing. If the browser does not open, visit **http://127.0.0.1:47381/**.

### 4. Enter your Glass Reach credentials

Click **+ Character** at the top. Fill in:

| Field | What to enter |
| --- | --- |
| Profile name | Your character's name |
| Existing character ID | Your Glass Reach character ID |
| Separate game token | Your own Glass Reach access token — required for your first connection, even though the label says optional |

Click **Save profile**, then **Agent settings → Reconnect selected character → Confirm action**. Click **Sync**; your character and location should appear with a **Live** status. The initial empty **Player** profile can be ignored.

Want a new character instead? Leave the ID blank when saving your profile, then use **Browse seats & templates** in Agent settings. Creation depends on your game permissions.

### 5. Connect Codex

In **Agent settings**, click **Connect / check Codex**. Wait for **Codex connected**. You can leave the model at **Account default**. Optionally edit the master prompt and click **Save preferences**.

This dashboard starts its own Codex conversation; you do not need to open a particular desktop chat.

### 6. Play

Use **Inner thoughts** for questions and planning. Switch to **Act in game**, describe what your character does or says, and click **Act** to carry it out. Your messages, inner thoughts, narrated outcomes and game events share **The unfolding story**. Prompt buttons above the box are shortcuts.

Next time, open the same launcher and use the same folder. Your credentials and records are saved locally. Never share your token or the `.glassreach-data` folder.

**Stuck?** “Not in this world” → reconnect your character. “Codex could not start” → repeat step 2 and reopen the launcher. “node is not recognized” → install Node.js, then reopen the launcher. To look around without accounts, open **Open Glass Reach Demo.cmd** instead; its data and replies are fictional.

## Message modes

- **Talk to Codex:** private questions, discussion and planning in your character’s inner voice. It never executes game actions. Proposed actions can be reviewed separately.
- **Act in game:** describe actions and dialogue naturally. Sending authorizes the requested sequence. The agent chooses one step at a time, using fresh observations and previous results. It can inspect objects between actions. It stops on a refusal, uncertain delivery, Stop, or a 12-step limit.

Stop prevents subsequent steps; it cannot undo an action already sent. Interrupted or uncertain actions are never automatically retried. Unsolicited and autopilot suggestions always remain approval-only.

## Features

- Live dialogue, movement, combat, check and item events, with searchable saved history.
- Connections in Atlas centered on the current location, including branches and loops.
- Saved schematic atlas diagrams and SVG export; these are not authoritative geographical maps.
- Collapsible Play stats and inventory; full properties, skills, conditions and progression in Character.
- Ready/backpack organization, item details and contextual actions. Grouping is personal organization, not an engine equipment command.
- Relationships, memories, goals, documents and local notes.
- Versioned master prompt, conversation reset/archive, character exports and persistent drafts.
- A Watch & automation composer tab for arrival/reply/water/dusk watches and approval-only background suggestions.
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
