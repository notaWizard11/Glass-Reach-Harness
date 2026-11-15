[Guide home](README.md)

# Rules & updates

Use **Rules & updates** for two separate feeds: harness release notes and game-engine rules.

## Harness updates

The top panel displays the installed build's [CHANGELOG.md](../../CHANGELOG.md), the same notes linked prominently from the GitHub README. The newest section is expanded; open older sections for previous changes. **Reload harness notes** reads that local file again. **View changelog source** opens the original Markdown.

These are software feature and fix notes, not game rules. They do not go into agent rules context or affect the engine's read marker. **Unreleased** means changes in the working build, not a published release. This panel does not check GitHub for a newer installation or download code; update the harness as described in the [README](../../README.md).

## Read the engine rules feed

The harness checks the engine's reported rules version during live sync and fetches updates when needed. Choose **Check engine rules** to request a check yourself. The tab shows the downloaded version, pending updates or errors, and expandable source changelog pages.

Choose **Mark engine updates seen** after reading. This is your local reading marker, separate from acknowledging a successful download to the engine.

Downloaded rules context is supplied with Codex requests. Live observations and inspection still take precedence over old notes or remembered mechanics. Historical character memories remain part of the story; a rules update does not rewrite them.

## Review suggested prompt changes

1. Choose **Review rules & propose prompt updates**.
2. Codex uses the Inner thoughts model to compare the rules with your saved prompts.
3. Read each proposal's reason and compare the current and replacement text.
4. Choose **Apply proposed change** or **Dismiss** individually.

The review does not automatically change prompts or perform game actions. If the rules or prompt have changed since the proposal was made, run a new review rather than applying an outdated replacement.

Applied changes appear in **Settings → Master Prompts List**, where you can refine them further. A prompt change adjusts agent instructions; it does not implement a missing UI feature, activate a new character sheet or bypass execution permissions. Engine changes that require new harness code still need a software update.

Related: [Settings](Settings.md) · [Character](Character.md) · [Journal](Journal.md)
