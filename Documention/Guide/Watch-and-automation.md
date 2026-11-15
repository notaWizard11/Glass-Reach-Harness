[Guide home](README.md)

# Automation

The **Automation** tab contains watches, readied actions and autopilot. The composer's **Watch & automation** mode contains watches and readied actions, plus a shortcut to Automation; autopilot controls are only in the dedicated tab.

| Feature | Result |
| --- | --- |
| Notification watch | Records a notification when its condition matches; no game command. |
| Readied action | Sends one exact action or line of dialogue approved in advance. |
| Autopilot | Uses Codex to choose actions within your goals, permissions and limits. |

Keep the server running and PC awake. Active watches and armed actions join the normal observation polling even when ordinary **Live** polling is off. Checks can be delayed by other requests and are not guaranteed to capture a short-lived state between observations.

## Choose a shared trigger

Choose **Create notification watch** or **Ready an action**. Select a category button, then a trigger tag. Only relevant condition fields are shown.

| Category | Available conditions |
| --- | --- |
| Movement | A chosen character arrives, leaves, is present or absent; you reach a selected destination. |
| Conversation | Speech addressed to you or speech nearby; optional speaker and case-insensitive phrase filter. |
| Resources | Water or HP at or below a configured threshold; health drops between observations. |
| Combat | An attack, hit or miss against you, optionally from a selected attacker; a chosen visible character (or yourself) is wounded or downed. |
| Inventory | An item ID enters or leaves your observed inventory; blank matches any item. This compares IDs, not changes in a stack's quantity. |
| Environment | An exact reported time-of-day value or weather containing your text. |
| Timing | Real-time delay in minutes from arming, or an absolute game-time deadline in seconds. |
| Actions | A specified verb, optionally for a target ID, is reported available by the game. |

Choose **Where I arm this**, **Selected location**, or **Anywhere in this world** as the location scope. Scope checks where your character is when the condition is evaluated. For a destination trigger, select Anywhere or the destination as scope so leaving the starting location does not prevent it from firing. An absent character means not present in your observation, not a proven location elsewhere.

Choose **Fire if already true** for state conditions that may fire at the next check, or **Wait until it becomes true** to wait for a false-to-true change. New-event triggers only use events after arming, regardless of that choice. Inventory and health-drop conditions compare successive observations.

## Notification watches

Set an expiry of 5, 15, 30, 60 or 120 real-time minutes, then choose **Set watch**. There can be up to 12 active notification watches per profile. Each notifies once, or ends on expiry or a changed character/world connection. Remove a watch to cancel it. **Public schedule** displays the game's schedule.

Watches are held in memory and must be set again after restarting the server. They do not use a model or send an automatic reply.

## Readied actions

Choose an exact line of dialogue or an exposed game action and its inputs. Select an expiry, then **Review command** and **Approve & arm**. A delay must be shorter than the expiry.

Up to 12 readied actions can be armed per character. Each fires once within its approved world, location scope and expiry. State conditions are checked again before dispatch. **Edit & review** changes a rule after approval; **Disarm** cancels it. The exact command is fixed: the harness does not ask a model to choose a new target or response when the trigger fires.

Armed actions survive server restarts until triggered, expired or disarmed. Interrupted or uncertain deliveries are not automatically retried. Disarming cannot undo a command already sent.

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
