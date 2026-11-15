[Guide home](README.md)

# Play

Use **Play** as your main place to follow the scene and interact with the world. The location banner shows the latest observed surroundings. The side panels hold compact stats, inventory, nearby people, objects and available actions; click their headings to collapse them.

## Read the story

- **Storyboard** presents scenes newest first, with a prose passage above the underlying records. Click a scene title to collapse or expand it. **Summarize** asks for a short inner reflection on that scene.
- **Auto prose** writes scene passages using its selected model. Turn it off to stop automatic scene-writing requests. In the current build it can continue while you visit another section if the browser tab is visible and Storyboard mode remains selected.
- **Detailed log** shows individual messages and events. **Story filters** lets you toggle several event types independently. Thin scene lines group related entries. **Record ▾** beside an entry's timestamp opens technical details over the log.
- Search the saved story or choose **Load earlier scenes** to look farther back. The detailed log has its own search and **Show more** control.

## Send a request

Choose a mode in the bottom composer before sending:

| Mode | What sending means |
| --- | --- |
| **Inner thoughts** | A private discussion of possibilities. It does not send dialogue or actions to the world. |
| **Act in game** | Authorization to carry out the actions or dialogue in your request. |
| **Watch & automation** | Opens notification watches and readied actions, with a shortcut to [Automation](Watch-and-automation.md) for autopilot. |

For example, use Inner thoughts for “What do I know about this person?” Use Act in game for “Ask the scout what she saw on the road.” Prompt buttons prepare common requests. **Ctrl + Enter** sends the message.

Game requests proceed one step at a time with fresh observations. **Stop** prevents later steps; it cannot undo a command already sent. A refusal or uncertain result ends the sequence rather than automatically retrying it.

## Leave and return

Click **Set Away** to save a departure bookmark. When you come back, choose **Return to Active · summarize**. The saved **While you were away** briefing covers the interval's high points, not every scene. It queues if Codex is busy; failed briefings can be retried without moving the bookmarks.

For a different interval, select a period and click **Catch me up**. **Caught up through this recap** or **Caught up to displayed scene** advances your separate read marker. Reading or generating a summary alone does not mark everything read.

**Live** enables ordinary background polling; the moving activity symbol shows its status. **Sound** toggles audible story notifications. A hidden browser may delay rendering, but the running server continues collecting updates. Coverage notices explain missing or still-syncing history.

Related: [Quests](Quests.md) · [Journal](Journal.md) · [Settings](Settings.md)
