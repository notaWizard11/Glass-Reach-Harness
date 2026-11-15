[Guide home](README.md)

# Atlas

Use **Atlas** to understand places and routes your character knows, or to create an illustration of a scene. Switch between **Diagrams** and **Scene images** at the top.

## Diagrams

1. Choose a scope: **Current area**, **Known region** or **Route plan**.
2. Describe what you want emphasized, such as “Show the known route to the well and mark uncertain connections.”
3. Click **Request diagram** to have Codex prepare it.
4. Select a saved diagram, adjust **Diagram zoom**, or choose **Download SVG**.

**Save observed connections** records a diagram of known connections without asking Codex to invent a map. The connection view can branch around the current location; it is not limited to a straight route.

Diagrams are schematic, not surveyed geography. A drawn line is not permission to travel and cannot establish an undiscovered exit. Request movement through **Act in game** in the composer, where the live game can confirm the route.

## Scene images

Open **Scene images**, describe the desired view under **What should the image show?**, then click **Generate scene image**. Select a saved image to preview it or use **Download PNG**.

This uses the separate OpenAI Images API, not your Codex conversation model. Image generation requires `OPENAI_API_KEY` in the harness server's environment and a restart; requests incur API usage. The image is an illustration based on supplied observations, not evidence of hidden people, objects or geography.

## Known places

The **Known places** section retains places recorded for this character. Use it as a reference alongside the maps; observations can become stale as the world changes.

Related: [Play](Play.md) · [Settings](Settings.md)
