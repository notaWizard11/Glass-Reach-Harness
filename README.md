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

Click **Save profile**, then **Settings → Reconnect selected character → Confirm action**. Click **Sync**; your character and location should appear with a **Live** status. The initial empty **Player** profile can be ignored.

Want a new character instead? Leave the ID blank when saving your profile, then use **Browse seats & templates** in Settings. Creation depends on your game permissions.

### 5. Connect Codex

In **Settings**, click **Connect / check Codex**. Wait for **Codex connected**. You can leave the model at **Account default**. Optionally edit the master prompt and click **Save preferences**.

This dashboard starts its own Codex conversation; you do not need to open a particular desktop chat.

### 6. Play

Use **Inner thoughts** for questions and planning. Switch to **Act in game**, describe what your character does or says, and click **Act** to carry it out. Your messages, inner thoughts, narrated outcomes and game events share **The unfolding story**. Prompt buttons above the box are shortcuts.

Next time, open the same launcher and use the same folder. Your credentials and records are saved locally. Never share your token or the `.glassreach-data` folder.

**Stuck?** “Not in this world” → reconnect your character. “Codex could not start” → repeat step 2 and reopen the launcher. “node is not recognized” → install Node.js, then reopen the launcher. To look around without accounts, open **Open Glass Reach Demo.cmd** instead; its data and replies are fictional.

## Message modes

- **Talk to Codex:** private questions, discussion and planning in your character’s inner voice. It never executes game actions. Proposed actions can be reviewed separately.
- **Act in game:** describe actions and dialogue naturally. Sending authorizes the requested sequence. The agent chooses one step at a time, using fresh observations and previous results. It can inspect objects between actions. It stops on a refusal, uncertain delivery, Stop, or a 12-step limit.

Stop prevents subsequent steps; it cannot undo an action already sent. Interrupted or uncertain actions are never automatically retried. Ordinary inner thoughts do not create action approvals. Quest discovery records local story threads; it never executes game actions.

## Features

- Live dialogue, movement, combat, check and item events, with searchable saved history.
- Connections in Atlas centered on the current location, including branches and loops.
- Saved schematic atlas diagrams and SVG export; these are not authoritative geographical maps.
- Collapsible Play stats and inventory; full properties, skills, conditions and progression in Character.
- Ready/backpack organization, item details and contextual actions. Grouping is personal organization, not an engine equipment command.
- Relationships, memories, goals, documents and local notes.
- Versioned master prompt, conversation reset/archive, character exports and persistent drafts.
- A Watch & automation composer tab for arrival/reply/water/dusk watches, readied actions and optional background quest discovery.
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

The story feed checks the game every five seconds while Live is enabled, including when the browser tab is in the background. Keep the dashboard server running and the computer awake. Turning off Live pauses these checks for that character. Browsers may delay background rendering; returning to the tab immediately loads the collected updates.

**Storyboard** groups the saved record into scenes, newest first. Click a scene title to collapse or expand its contents. Each scene reads as a continuous passage, with your character's dialogue and confirmed actions woven into the story. Routine actions are condensed. **Auto prose** writes or updates loaded scenes while the storyboard is visible; disable it to avoid automatic model use. In **Settings → Auto prose · scene writing**, choose a separate model for these passages (or leave it on the general model). Inner thoughts, scene reflections and catch-up recaps keep the Inner thoughts model; game actions keep their own model. Existing saved passages remain cached. The complete record stays available while the prose catches up. Private inner thoughts remain distinct from world events. Choose **Summarize** beside the location title for a short, source-linked inner reflection based on all recorded events in the scene. **Detailed log** keeps the familiar message filters and uses thin scene brackets to group related entries. Search the storyboard or load earlier scenes to access records beyond the recent log window.

Before stepping away, select **Set Away** above the storyboard. When you return, select **Return to Active · summarize**. These explicit, per-character bookmarks save both ends of the interval; leaving the dashboard live does not move them. Returning automatically prepares a **While you were away** briefing of the high points, consequential changes, unresolved questions and matters needing attention—normally 3–6 short bullets, rather than scene narration. It waits if Codex is busy. Bookmarks survive restarts, and failed summaries offer a retry without changing the interval. Status changes require a successful, complete game sync. This is a dashboard reading status, not a game command or an autopilot switch.

You can also choose **Catch me up** for events since your last caught-up marker, the last recorded game day, or all saved history. The agent reads longer intervals in cached batches; these requests use the Inner thoughts model and can take longer for a large archive. Click a numbered source to see its original event. Use **Caught up through this recap** or **Caught up to displayed scene** when you have finished reading. Polling and generating recaps never advance that marker automatically.

Recaps use records saved for the selected character. Coverage notices show when history is still syncing or the connection is interrupted. Events the game never exposed cannot be reconstructed; keep the local server running to collect updates while away. Normal inner-thought questions also search older saved events for relevant context.

Settings loads the models available to your signed-in Codex account automatically. Choose a General model and optional overrides for Inner thoughts, Game actions & narration, Auto prose, Atlas diagrams, Quest discovery, and Autopilot; then select Save model choices. Empty overrides inherit the general model. Account default uses your Codex configuration.

Open **Watch & automation** from the navigation or the Play composer. Choose **Ready an action**, select a trigger and one exact game action or line of dialogue, then review and approve it. Up to 12 actions per character can wait at once. Edit and approve an armed rule again to replace it, or disarm it. The game must still be connected to that character and the character must be in the scene where you armed the command. Each rule expires at the time you choose. The dashboard server checks rules in the background even with Live off. The story feed and rule list show what happened.

To illustrate a scene, set an OpenAI API key in the dashboard server’s OPENAI_API_KEY environment variable and relaunch. Open **Atlas → Scene images**, describe the scene, and click **Generate scene image**. This sends the request and a short visual description of the last observed location to the OpenAI Images API. Generation uses your API project’s billing. Images are saved locally for the selected character and can be downloaded as PNG files.

## Rules and prompt preferences

**Rules & updates** keeps the engine's world-specific changelog locally. Normal live sync checks the reported rules version and fetches new pages; **Check for updates** requests a fresh check. Fetching acknowledges the entries to the engine, but the dashboard's **Mark updates seen** is separate. Downloaded rules accompany every Codex request as mechanics data, with the character's actual sheet/legacy status. Dated fallback notes remain provisional; current observations and applicable newer engine rules take precedence. The feed reports failed or incomplete syncs. Rules text does not grant actions or change automation permissions.

**Review rules & propose prompt updates** uses the Inner thoughts model to compare the rules with your saved prompt list. It shows explanations and current/proposed text. Apply or dismiss each proposal individually. Nothing is applied automatically; if a prompt or rules version changed after review, run another review. Required code changes are separate from prompt preferences.

In **Settings → Master Prompts List**, expand a query type to edit its role instructions, task guidance, and optional context. Direct requests can control recent-event/message counts and inclusion of historical matches, quests, memories, documents and notes. Evidence jobs (scene prose, recaps, quest discovery and rules review) use their selected evidence batches instead. Current observations for direct requests, execution results, rules and fixed permission contracts cannot be switched off. Expand the effective-instructions and rules panels to inspect the saved input layers. Save each prompt separately; previous text can be loaded into the editor and saved to restore it. The existing shared Master prompt and character additions still apply across Codex types. Images use their separate image API; watches/readied actions use fixed triggers and commands, not model prompts.

## Autopilot

In **Settings**, choose an **Autopilot** model, then open **Watch & automation → Autopilot**. Write your character's motivations and goals, choose permissions for talking, travelling, interacting with things, attacking, and self-defence, and set a decision interval, duration, action limit and model-decision limit. Optionally restrict allowed locations (include the current location). **Save configuration** keeps it off; **Review & start** shows the permissions you are authorizing before starting.

Autopilot makes one model decision at a time and may wait, inspect, speak or perform one permitted action. Each decision uses Codex, including decisions to wait. The dashboard checks permissions against fresh game observations before dispatch. Interaction permission includes giving items and opening locks; only supported, currently exposed verbs are accepted. Self-defence permits retaliation only against a specific attacker supported by a recent recorded attack since activation. It does not treat spoken threats as attacks. Finishing blows and following are excluded.

The local server must remain running and the PC awake. Autopilot continues with the browser closed or Live unchecked. Manual messages and game actions pause it; so do expired limits, refused or uncertain actions, connection problems, and a server restart. Pause prevents later commands but cannot undo one already sent. Review the activity log before restarting. Existing readied actions and the game's own idle survival routines remain separate from these permissions. Demo mode illustrates the workflow but only waits.

## Quests and Journal

**Quests** replaces Approvals. Choose **Discover quests from the story** to read saved events in resumable batches and find supported mysteries, promises, obligations and errands. Each discovered thread links to its evidence. Track, edit, block, complete or dismiss it; discovery preserves your chosen progress. The first scan can take several model calls; later scans process only new events. The Quest discovery model setting controls this work. Background discovery is optional in Watch & automation.

In **Inner thoughts**, say “Add this to my quests”, “Mark my water quest completed”, or “Save what just happened in my memories”. The agent resolves the context and the dashboard confirms the records actually saved. These are local, per-character records and survive a fresh conversation. Writing a memory into the game remains a separate explicit action.

**Atlas** now contains known places. **People & relationships** has its own tab. **Journal** holds notes, local memories, game memories and copies of documents whose text has been observed or inspected. Copies persist after the item leaves inventory; changed text keeps earlier observed versions. Documents never seen by the dashboard cannot be reconstructed.
