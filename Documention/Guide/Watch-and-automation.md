[Guide home](README.md)

# Watch & automation

Use this tab to decide what the harness should notice or do while you are occupied. The composer offers the same controls; settings are shared between the two views.

| Feature | What it does |
| --- | --- |
| Notification watch | Alerts you when a selected condition occurs. |
| Readied action | Sends an exact action or reply you approved in advance, once. |
| Autopilot | Asks the selected model what to do within your goals, permissions and limits. |

Keep the server running and the PC awake. These features can work with the browser in the background. Turning **Live** off does not disable them.

## Set a notification watch

Choose a reply, arrival, low water or dusk, then choose **Set watch**. For a reply or arrival, enter the character's name. A watch notifies you; it does not make the character respond. **Public schedule** opens the game's schedule.

There is one active notification watch per profile. Watches are kept in memory, so set them again after restarting the server.

## Ready an exact action

1. Choose **Ready an action**.
2. Pick a trigger: a chosen person's arrival, their reply (optionally containing a phrase), water at or below 3, or dusk.
3. Enter the exact reply or game action, and choose an expiry.
4. Review and approve it before arming.

You can keep up to 12 readied actions per character. Each fires once, subject to its character, location and expiry checks. Water or dusk triggers may fire immediately if already true. Use **Edit & review** to revise an entry or **Disarm** to cancel it.

Armed actions survive a server restart until they fire, expire or are disarmed. An uncertain delivery is not automatically retried. Disarming cannot undo an action already sent.

## Configure autopilot

Write **Motivations & goals** as instructions for how the character should behave. For example: “Stay in the yard, answer questions politely, and ask visitors whether they saw the missing scout. Do not make promises.”

Enable only the permissions you intend to grant:

- **Talk and reply** — speak to others.
- **Travel** — move between locations.
- **Interact with things** — perform supported object interactions, including actions such as taking or giving items.
- **Initiate attacks** — start attacks.
- **Self-defence** — respond to a recent recorded attack from that specific attacker; a threat in dialogue alone is insufficient.

Choose the decision interval, running time, action cap and decision cap. Optional location restrictions constrain travel; with none selected, any known reachable route can be considered. Include the current location when setting restrictions. Choose the **Autopilot** model in Settings.

**Save configuration** leaves autopilot off or pauses an active run. **Review & start** shows the instructions, permissions, model and limits before the final start. Monitor the activity log and use **Pause autopilot** to take control. Each decision can use model tokens even when it chooses to wait.

Manual messages and game actions pause autopilot. It also stops on expiry, relevant limits, refusal, uncertain delivery or lost connection, and restarts paused after a server restart. Permissions do not enable every engine command: following and finishing blows are excluded. Demo mode only waits.

## Background quest discovery

Under **While I'm elsewhere**, choose whether to discover quests in the background or prepare them only when asked. Discovery updates the local quest list and uses Codex; it does not perform quests.

The game's own idle survival behaviour is separate from these controls. **Set Away** is a catch-up bookmark, not an autopilot switch.

Related: [Settings](Settings.md) · [Quests](Quests.md) · [Play](Play.md)
