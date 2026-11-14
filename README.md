# Riskagon — Frontier Trade Update (v0.5)

A browser multiplayer hex strategy game with a Three.js isometric board, a Socket.IO authoritative server, terrain physics dice, provincial development and Risk-style battles.

## v0.5 movement, borders and trade

- **Choose a stack size:** selecting land defaults to the movable army minus its required garrison. March mode retains a numeric picker, +/− buttons and All available while selecting the destination. Naval destination mode retains its quantity picker too.
- **Independent movement:** each troop gets two points per turn. Land costs one; owned roads, sailing, embarkation and landing cost half; bombardment costs one. Cohorts preserve remaining points when split, merged or landed, so exhausted troops cannot refresh by joining a fresh army. Movement selection consumes fresh eligible troops first. The old kingdom-wide allowance and stables movement bonuses are retired.
- **Vertex borders:** Road vertices, Wood wall, Stone wall and Gate use the same two-click origin/destination workflow. Only neighboring corners of a single hex side are valid. Roads are free and require occupation of both touching tiles (outer map borders need their one touching tile occupied). Roads still extend scouting two tiles.
- **Fortifications:** wood costs one wood and has three durability; stone costs two ore and has six. A committed attack deals up to three wall damage instead of entering that hex; crossing requires a subsequent move after destruction. Friendly walls need gates. Gates cost nothing and are limited to two per tile. Enemy gates do not grant attackers free passage. Docks do not bypass shoreline walls. Wall durability is visible on its border.
- **Visible treasury:** all five resources stay in a permanent strip above the canvas.
- **Player trade:** Trade lists only kingdoms with adjacent occupied tiles. Set the offered/requested resource and quantity; the recipient explicitly accepts or rejects. Acceptance rechecks adjacency and both balances, then exchanges atomically. Offers expire on turn end. AI accepts offers only when offered quantity is at least requested quantity.
- **Hidden taverns:** four random land tiles contain taverns. They appear only inside current scouting visibility. Occupying a tile within one hex grants shop access. Prices are offered units per one purchased resource: native resource 1:1; other goods cost 2 at distance 1–2 from matching terrain, 3 at distance 3, and 4 farther away (or absent). The trade form lists exact quotes before purchase.
- **AI profiles:** choose Full aggro, Explorer, Navy lover, Aggro Navy, Homebody or Slow and steady before adding an AI. Aggressive profiles initiate attacks; peaceful profiles retaliate only after provocation. Explorer prefers undiscovered tiles and proposes adjacent trades; naval profiles prioritize shipyards and fleets; Homebody expands only for missing resources within two hexes of home; Slow and steady leaves a larger garrison and avoids weak expansion. These are heuristic policies, not strategic search.

The sections below describe the underlying naval and production systems; v0.5 movement and border rules above supersede the earlier fixed movement and paid-road rules.

## Run in GitHub Codespaces

In an existing Codespace, pull this update, then install dependencies and start:

```sh
git pull origin main
npm ci
npm run assets:sync
npm run dev
```

For a new Codespace, create one on `main`. The devcontainer installs dependencies and the optional CC0 KayKit assets. Open forwarded port **3000**. Friends need a publicly forwarded port to connect. Procedural scenery and troops work without downloading the asset pack.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build; `npm run dev` serves the live development version.

## Turn flow

1. Create a realm, invite friends or add AI opponents. Draft unique banner colors, then starting locations in reverse order. Every kingdom begins with three troops and an outpost.
2. **Roll:** Grab either large die directly on the hex board, hold, drag and release. The keyboard-accessible **Roll dice** button throws them too. The server clamps the throw inputs, adds secret random orientation/spin, simulates rigid bodies, and records transforms at 30 fps from a 120 Hz simulation. Every client replays those same transforms in the board scene. The upward physical faces determine the result; no client result snap or second simulation is used. Turn actions remain locked until the final frame.
3. **Reinforce:** Click a highlighted outpost or settlement, then use +/−, W/S or arrow keys to allocate troops there. Escape or the back button returns to the discovered-territory view. Split the pool across structures and edit earlier allocations freely, even after the pool reaches zero. Troops stay in the reserve plan until you explicitly choose **Confirm placements & begin orders**. Movement, attacks, construction and ending the turn stay locked until confirmation.
4. **Orders:** Select a province to inspect it, march/attack, or explicitly open its build recipes. Roads highlight available shared edges in gold. Leave at least one soldier behind when marching. Roads halve movement cost and improve attacks. Each troop has its own two movement points.
5. End your turn. The first kingdom to **32 victory points** wins.

The opening round awards **zero reinforcement troops**, including matching-roll bonuses, so all players get a turn before troop income begins. Matching resource rolls still benefit all province owners. Matching troop output is banked for every owner. Bonuses earned on other players' rolls join that owner's next reinforcement pool; troops never appear automatically on the board during someone else's turn.

## Reinforcement economy

From round two, the start-of-turn pool is:

| Source | Troops |
| --- | ---: |
| Every two owned, occupied wood tiles | +1 |
| Every two owned, occupied brick tiles | +1 |
| Every two owned, occupied wheat tiles | +1 |
| Every two owned, occupied sheep tiles | +1 |
| Every two owned, occupied ore tiles | +1 |
| Each outpost | +2 |
| Each settlement | +3 |
| Each barracks | +3 |
| Each owned resource tile matching any production roll | Its structure troop output again |

Resource pairs are rounded down **separately for each resource**. Occupied means at least one soldier; empty claims and water do not form resource pairs. Structures earn their output even without a garrison. An outpost upgrades into a settlement: its base output changes from two to three, rather than adding both. A **settlement + barracks produces six troops per turn**, plus **six more** each time its number matches a production roll. Bare occupied tiles contribute resource pairs, but have zero structure production on a matching roll.

Troops all enter the reserve instead of being inserted automatically into barracks. Human placement is now an editable plan with explicit final confirmation. This is a deliberate balance interpretation of the requested troop production. The income disclosure shows territory pairs, structures and rolled production (including banked bonuses from rivals’ turns).

## Terrain dice physics

- **Mountains:** Solid, permanent rock cones and high-restitution contact knock dice back. The small physical rocks remain visible when optional mountain scenery condenses under fog rules.
- **Forest:** High friction and ground-level drag slow dice.
- **Clay hills:** Sticky, high-friction, zero-restitution contact and stronger drag.
- **Fields:** Neutral ground with ordinary bouncing and no terrain drag.
- **Pasture/desert:** Mild ground friction.
- **River/lake:** Buoyancy balances gravity at the waterline; drag and righting torque let dice float and settle with a readable upward face.

A thick, continuous floor catches bottom seams. Tall, overlapping static colliders follow all 66 exposed sides of the radius-five board, including the near/bottom edge. Visible low rails mark that perimeter. Collider positions and render positions share the same axial geometry. Cocked dice receive physical hops, never a prescribed outcome. A rare throw that cannot settle within the simulation limit is rejected so the player can retry without consuming the roll. Combat retries cocked simulations internally.

Troops, buildings and decorative forest/clay props are not rigid-body obstacles. Mountain collision rocks are fixed independently of fog and optional assets so physics cannot reveal concealed enemy structures. The authoritative simulation runs synchronously on the server; large numbers of simultaneous rooms would benefit from worker threads and replay payload compression.

## Player camera and commands

Your turn begins with a close camera fit around your discovered tiles. **My kingdom**, the back arrow, and **Escape** return to that overview. Scouting discovery is remembered, while current enemy ownership and units remain protected by fog. **WASD** or arrow keys pan the map; scroll zooms; hovering outlines the exact hex and shows its public/visible information. While a valid reinforcement structure is selected, **W/↑/→ adds** and **S/↓/← removes** one allocated troop instead of panning. Text fields retain their normal keyboard behavior.

Commands occupy a steady-height dock **below** the canvas; recipes scroll inside it rather than covering the map. The visible reinforcement breakdown separates outposts, settlements, barracks, resource pairs and rolled production. A gold +N marker previews each allocation; existing garrisons do not change until confirmation. Reinforcement placement is legal only at owned outposts/settlements on land, including empty garrisons. Occupied bare land, water and standalone docks cannot receive new troops.

The **Kingdom & treasury** toggle opens scores/resources and the chronicles. The activity strip gives brief updates even while the HUD is closed. Buttons support keyboard play for dice, drafting and allocation; selecting/moving between 3D hexes still uses a pointer.

## Naval command

1. Build a **shipyard** at an owned coastal outpost or settlement (2 wood, 2 brick, 1 ore). Select **Launch boat…** and an adjacent friendly/unclaimed water hex. A boat costs 2 wood and 1 ore and starts empty: launching never creates troops.
2. Select a neighboring coastal outpost/settlement and choose **Embark…** to load existing troops, leaving one soldier behind. Each boat carries at most **four naval troops**. Empty boats remain on water, but need crew to sail, attack or establish a landing dock.
3. **Sail…** moves through one adjacent lake/river hex per movement point. A split fleet must leave sufficient boat capacity for every troop left behind. Opposing fleets fight normal Risk-style combat on contact; shore troops never walk onto lakes.
4. **Bombard…** attacks an adjacent enemy land garrison from water. Each salvo removes `min(enemy army, ceil(naval troops / 2), 3)` troops, costs one movement point and never captures territory. Ordinary land troops do not retaliate. **Cannons** on the targeted province return fire, killing up to two naval troops simultaneously. If the last crew dies, that fleet's boats are lost. Cannons cost 1 wood, 2 brick, 2 ore at a land outpost/settlement.
5. Build a **dock** at an owned coastal outpost (2 wood, 1 brick), or select an unclaimed shore beside your crewed boat and choose **Construct landing dock** for the same cost. An expedition dock claims the shoreline but does not create an outpost or troops.
6. **Land at dock…** transfers selected naval troops to adjacent docked shore for one movement point. Friendly landing adds to its garrison. Landing at an enemy dock resolves normal land combat, including return casualties. Boats stay afloat and may receive another crew later. Build an outpost after landing if you want that new province to receive reinforcements.

Boats, shipyards, docks and cannons use bundled procedural 3D models with faction colors. Water fleets extend scouting and number visibility. Hidden fleets, cargo, movement locations and planned allocations are removed from other players' state.

## Watching other kingdoms

AI kingdoms issue **one decision every 1.6 seconds**, with production rolls retaining their physical playback duration. Reinforcement placement, construction, embarkation, sailing, bombardment, land movement and ending a turn each broadcast separately. The AI can develop coastal shipyards, launch/load boats, establish docks and use naval attacks.

Visible movements animate with a faction troop/boat token; construction and combat have a visual pulse. Only visible movement endpoints reach the client: a move into fog reveals departure only, and a move from fog reveals arrival only. Remote decisions appear as vague summaries such as “Kingdom AI 1 placed troops” or “built one structure,” without disclosing hidden counts, locations or structure types. Draft allocations remain private until confirmed. Camera navigation stays under the player's control during AI actions.

## Province construction

Build an outpost before adding upgrades. An outpost supports four additional upgrades; the settlement conversion does not consume one of those slots. Settlement conversion adds a victory point. Captured buildings are retained except walls.

| Construction | Cost | Effect |
| --- | --- | --- |
| Outpost | 1 wood, 1 brick | +2 troops/turn, enables upgrades and deployment |
| Settlement | 2 wood, 2 brick, 2 wheat, 1 sheep | Upgrade outpost base to +3 troops/turn |
| Homes | 2 wood, 1 brick, 1 wheat | +1 native resource on matching roll |
| Walls | 2 brick, 1 ore | Defense bonus; matching roll stores a defense charge (max 3) |
| Armory | 2 ore, 1 brick | Matching roll stores an attack bonus (max 3) |
| Farm | 2 wood, 1 wheat | Fields only; +2 wheat on matching roll |
| Lumberyard | 1 wood, 1 brick | Forest only; +2 wood on matching roll |
| Quarry | 1 wood, 2 brick | Hills only; +2 brick on matching roll |
| Mine | 2 wood, 1 ore | Mountains only; +2 ore on matching roll |
| Ranch | 1 wood, 2 sheep | Pasture only; +2 sheep on matching roll |
| Barracks | 2 wood, 2 brick, 1 ore | +3 troops/turn and +3 matching tile production |
| Stables | 2 wood, 2 wheat, 1 sheep | Matching roll stores one movement point (max 2) |
| Road | Free after occupation | Shared land edge; halves crossing movement cost |
| Bridge | 2 wood, 1 brick, 1 ore | Lets its builder cross the river hex |

## Fog and assets

The 91-hex board contains clumped resource provinces, rivers and lakes. Terrain types remain public. Unscouted resource scenery stays large; within one hex of troops/outposts it condenses. Upgraded provinces and owned roads extend scouting to two hexes. Production numbers appear within five hexes. The server masks remote ownership, troop counts, structures, rival resources, reserves and income breakdowns.

Optional models come from [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) and [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), both CC0. Original procedural scenery and infantry, archers and cavalry are bundled as fallbacks. See `ASSETS.md` for the art pipeline.

## Validation and project layout

`npm test` covers drafting, fog, shared-edge roads, bridges, production math, settlement upgrades, split placement, action locks, roll timing/idempotency, final-face/replay agreement, perimeter containment, buoyancy and terrain effects. The Socket.IO smoke test starts an isolated production server and plays two human clients through drafting, rolls, editable allocations, explicit confirmation and turn changes; it also checks a bot turn and reconnect replay.

- `shared/boardGeometry.js`: shared hex coordinates, edge/rock geometry and terrain profiles.
- `server/dicePhysics.js`: authoritative rigid-body simulation, recording and face detection.
- `server/realm.js`: game state, drafting, fog, reinforcement economy and action validation.
- `server/index.js`: rooms, roll completion timers, paced AI orchestration and realtime state delivery.
- `server/naval.js`: boat capacity, coastal construction, water travel, bombardment, cannons and landings.
- `server/bot.js`: one-decision AI planning, including naval play.
- `src/board.js`: Three.js map, troops, buildings, edge markers and perimeter rails.
- `src/dice.js`: in-board grab/throw input and authoritative replay interpolation.
- `src/main.js`, `src/style.css`: contextual turn controls and toggled HUD.

## Remaining prototype limits

Matches live in server memory and disappear on restart. Rooms have no account authentication and reconnect identity is only a session token. Trading and durable saves are not implemented. Lakes now support boats and dock landings; bridges still unlock rivers. Naval balance uses the documented four-troop capacity and deterministic shore salvos. Ship-to-ship fights and hostile landings use Risk dice. AI remains heuristic, and movement animations depict each stack with a representative token. Combat remains server-resolved with numerical battle summaries rather than per-round physical replay on the map. Optional artwork is downloaded separately; full asset optimization and animation blending remain future work.
