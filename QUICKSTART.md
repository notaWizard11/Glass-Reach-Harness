# Glass Reach Harness — quick start (Windows)

Start from the [Glass Reach Harness repository](https://github.com/notaWizard11/Glass-Reach-Harness).

## 1. Download and extract

Click **Code → Download ZIP**, then right-click the ZIP and choose **Extract All**. Open the extracted folder. You do not need Git or a GitHub account, and there is no `npm install` step for this project.

## 2. Check the requirements

- **Node.js 22 or newer:** install [Node.js for Windows](https://nodejs.org/en/download) if needed. The launcher can also use an existing bundled Codex Node runtime.
- **Codex installed and signed in on this PC.** The harness can discover supported native CLI installations, including the bundled desktop CLI. If the connection fails, follow the Windows instructions in the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli). In a new Command Prompt, check `codex --version` and `codex login status`; run `codex login` if sign-in is needed. [Authentication help](https://learn.chatgpt.com/docs/auth).
- **Your Glass Reach game token and character ID.** Get these from your game access provider or the agent you already play through. The game token is not your ChatGPT password or an OpenAI API key.

No harness plugin, special Codex chat or separate OpenAI API key is required for ordinary play using Codex account sign-in.

## 3. Open the harness

Double-click **Open Glass Reach Harness.cmd**. Keep its server terminal running. If the browser does not open, visit **http://127.0.0.1:47381/**.

To try it without accounts, use **Open Glass Reach Harness Demo.cmd** instead. Everything in demo mode is fictional.

## 4. Connect your character

Click **＋ Character** and fill in:

| Field | Enter |
| --- | --- |
| Profile name | Your character's name |
| Existing character ID | Your game character ID |
| Separate game token | Your own game token; required for a new installation even though the field is labelled optional |

Click **Save profile**. Then open **Settings → Reconnect selected character**, review the character and click **Confirm action**. Click **Sync**. You should see your location and **Live** connection status. The initial empty Player profile can be ignored.

For a new character, save a profile with your token and a blank ID, then use **Settings → Browse seats & templates**. Creation is subject to your game grant; it is not unlimited character creation. Profiles sharing a token share one active game seat—switching the dropdown alone does not reconnect that seat.

## 5. Connect Codex and play

In **Settings**, click **Connect / check Codex**. When connected, choose models or keep **Account default**. Changes to model choices need **Save model choices**.

In **Play**, use **Inner thoughts** to ask questions privately. Switch to **Act in game**, describe your character's actions or dialogue, and click **Act** to authorize them. Before leaving, use **Set Away**; on return, choose **Return to Active · summarize** for a highlights briefing.

Next time, launch from the same folder. Your records and encrypted token are saved locally. Keep `.glassreach-data` private and back it up before updating.

## If something does not connect

- **Node not found:** install Node.js and reopen the launcher.
- **Codex could not start:** check the installation separately from sign-in. A working desktop CLI may be discoverable even if `codex` is not on your terminal's PATH. An advanced override, `GLASS_REACH_CODEX`, must point to the native executable.
- **Not signed in:** run `codex login`, complete sign-in, then reconnect Codex in Settings.
- **Wrong character / not in this world:** select the intended profile and use **Reconnect selected character**.
- **Port already in use:** the launcher reuses an existing harness. If another program owns port 47381, close that program or choose another `PORT` before launching; do not start a second server against the same records.

See the [README](README.md) for background-operation limits, model usage, backups and updates.
