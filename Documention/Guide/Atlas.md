[Guide home](README.md)

# Atlas

The **Live map** expands automatically as the harness observes your character's travels. Geometry is retained separately for each character and world. No model call is needed to collect or draw it.

## Navigate the map

The narrow **Known locations** column sits on the left; the map fills the remaining space.

- Search by location name or description. Choose **Jump & zoom** to centre on a positioned location and fit its reported footprint. Enter in the search field jumps to a matching positioned place or route endpoint.
- **Jump to route end** shows an authored endpoint when the destination itself has no recorded coordinates. It does not establish that destination's centre or size. **No position yet** means there is insufficient geometry to jump there.
- Select a point to highlight it and anchor subsequent zoom to it. Drag the background to pan; scroll or use **Map zoom** to change scale.
- **Centre on Self** preserves your zoom. **Zoom to Self** centres and moves to a close view, preserving an already closer zoom.
- **POI details** opens the selected place's saved details. The field-notes panel below the map follows the selection.

Camera position and selection survive ordinary live redraws. The zoom range adapts to the explored area, so distant discoveries do not prevent close views. Selecting a place changes only your view; travel still requires a game action.

## Geometry, labels and connections

Shaded rectangles show reported place extents. Dotted circles show reported landmark radii, not architectural wall outlines. Solid gold lines follow engine-authored route polylines; dashed lines connect positioned places whose actual course is unknown. Elevation may be reported, but this is currently a top-down map without floor switching. Region/local shortcuts and separate interior levels are not implemented yet.

Open **Legend & labels** in the map corner to toggle location, landmark, character, route-destination, dimension and self labels. Features remain visible when their labels are off. Preferences are remembered in this browser for the character/world. Labels try alternate positions and suppress crowded lower-priority names; the selected or hovered point gets priority within enabled categories. Markers and text retain readable sizes while geography scales.

Expand **Connections** below the map for the map key, observation time, unplotted connections and known places without geometry. Routes and footprints are remembered observations, not a guarantee that a passage is currently accessible. **Download SVG** exports the displayed map.

## Visible characters

Cyan markers show currently visible characters with coordinates from the latest live observation. Select a marker to focus zoom and open **Character details**. Visible characters without coordinates appear only in **Visible here**, labelled **position not reported**. A character is not shown in both places.

Markers and the unpositioned list update on successful observations and disappear when the character is no longer visible. They are hidden when the harness falls back to a saved observation; the atlas does not keep last-seen character markers. This is an observed view, not continuous tracking between server polls.

## Commission maps and images

**Commission a map** and **Commission an image** open compact menus; they can be opened by hover or click, or with keyboard/touch controls. Click outside or press Escape to dismiss.

For a diagram, choose **Current area**, **Known region** or **Route plan**, describe your request, and choose **Request diagram**. Saved diagrams and **Return to live map** are in the same menu. **Save observed connections** saves a schematic without a model call. Commissioned and connection diagrams are schematic; their positions are distinct from the live map's measured geometry.

For an illustration, describe the subject and choose **Generate scene image**. **Scene images** holds saved previews and **Download PNG**. Images use the separate OpenAI Images API: set OPENAI_API_KEY in the server environment and restart to enable it. Requests incur API usage. Illustrations do not establish hidden people, objects or geography.

Related: [Play](Play.md) · [People & relationships](People-and-relationships.md) · [Settings](Settings.md)
