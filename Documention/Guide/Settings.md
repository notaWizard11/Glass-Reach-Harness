[Guide home](README.md)

# Settings

Use **Settings** to personalize the harness, choose models and control the instructions sent to Codex.

## Appearance and models

Choose a theme under **Appearance**: Glass Reach, Ember, Tide, Desert or Ivory. The palette applies throughout the app.

Connect or check Codex here, then choose a general model and overrides for **Inner thoughts**, **Act in game**, **Auto prose**, **Autopilot**, **Atlas diagrams** and **Quest discovery**. Save the model choices. A purpose without an override inherits the general choice; available models depend on your account. Scene reflections, catch-up briefings and rules reviews use the Inner thoughts model.

A cheaper Auto prose model can write scene passages while a more capable model handles decisions. Ordinary game polling does not use model tokens; generated responses and automated model decisions do.

## Master Prompts List

Expand an entry to see and edit how that kind of request is instructed:

- Inner thoughts
- Act in game
- Autopilot
- Atlas diagrams
- Auto prose
- Scene reflection
- Catch-up / away briefing
- Quest discovery
- Rules review

Edit the role instructions and, where present, the automatic task prompt. Direct-query entries do not need an automatic task prompt. Use **Save this prompt** for each entry you change.

For direct requests, context controls let you adjust recent event/message counts and optional history, quests, memories, documents and notes. Evidence-based jobs such as scene writing and catch-up use selected record batches instead, so those controls are disabled. Current state, results, rules and execution restrictions still apply.

Expand the effective-instruction preview to inspect the saved instructions and engine context together. **Reload saved prompt list** refreshes that snapshot and discards unsaved list edits. Selecting an earlier prompt version restores its text for review; save it to apply it. That does not restore old context settings.

These query-purpose prompts apply across characters. The separate shared **Master prompt** supplies common preferences, while character-specific additions tailor an individual character. Save those preferences with **Save preferences**. Prompt edits cannot expand the harness's action permissions.

## Session and character management

**Start fresh session** archives the earlier conversation while retaining game records and saved prompts. It is useful when you want a clean conversation without losing your journal or story history.

Use **Reconnect selected character** when the selected profile needs its game connection renewed. Character creation and seat/template choices depend on what the game account allows. The top dropdown alone does not always switch a shared token's active seat.

JSON exports contain private campaign records. Keep exports and backups private unless you have reviewed what they contain.

Ordinary Codex play uses Codex sign-in. Atlas scene images separately require an OpenAI Images API key in the server environment; see [Atlas](Atlas.md). For installation and credentials, follow the [quick-start](../../QUICKSTART.md).

Related: [Rules & updates](Rules-and-updates.md) · [Automation](Watch-and-automation.md)
