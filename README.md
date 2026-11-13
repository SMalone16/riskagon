# Riskagon — The Board & Reinforcements Update (v0.3)

A browser multiplayer hex strategy game with a Three.js isometric board, a Socket.IO authoritative server, terrain physics dice, provincial development and Risk-style battles.

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
3. **Reinforce:** Place every troop in the reserve on your occupied land or a land structure. Split the pool across territories, or use **Place all**. Movement, attacks, construction and ending the turn remain locked until the pool is empty.
4. **Orders:** Select a province to inspect it, march/attack, or explicitly open its build recipes. Roads highlight available shared edges in gold. Leave at least one soldier behind when marching. Roads halve movement cost and improve attacks. You get two movement points, plus any stored mobility.
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

Troops all enter the reserve instead of being inserted automatically into barracks. This is a deliberate balance interpretation of the requested troop production. The income disclosure shows territory pairs, structures and rolled production (including banked bonuses from rivals’ turns).

## Terrain dice physics

- **Mountains:** Solid, permanent rock cones and high-restitution contact knock dice back. The small physical rocks remain visible when optional mountain scenery condenses under fog rules.
- **Forest:** High friction and ground-level drag slow dice.
- **Clay hills:** Sticky, high-friction, zero-restitution contact and stronger drag.
- **Fields:** Neutral ground with ordinary bouncing and no terrain drag.
- **Pasture/desert:** Mild ground friction.
- **River/lake:** Buoyancy balances gravity at the waterline; drag and righting torque let dice float and settle with a readable upward face.

A thick, continuous floor catches bottom seams. Tall, overlapping static colliders follow all 66 exposed sides of the radius-five board, including the near/bottom edge. Visible low rails mark that perimeter. Collider positions and render positions share the same axial geometry. Cocked dice receive physical hops, never a prescribed outcome. A rare throw that cannot settle within the simulation limit is rejected so the player can retry without consuming the roll. Combat retries cocked simulations internally.

Troops, buildings and decorative forest/clay props are not rigid-body obstacles. Mountain collision rocks are fixed independently of fog and optional assets so physics cannot reveal concealed enemy structures. The authoritative simulation runs synchronously on the server; large numbers of simultaneous rooms would benefit from worker threads and replay payload compression.

## Minimalist board controls

The board fills the game area. Turn instructions and current actions appear in a compact overlay inside the map. Build menus only appear after selecting **Build…** during Orders. Deployment shows troop placement controls instead. No permanent side-panel catalog, treasury or event log crowds the board.

**Kingdom & treasury** toggles scores, resources and the expandable chronicles/battle summary. **My kingdom** focuses your homeland; **View realm** resets the camera. Keyboard buttons provide alternatives to grabbing dice and clicking draft locations. Hex movement and placement still use the pointer-based 3D board.

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
| Road | 1 wood, 1 brick | Shared land edge; halves crossing movement cost |
| Bridge | 2 wood, 1 brick, 1 ore | Lets its builder cross the river hex |

## Fog and assets

The 91-hex board contains clumped resource provinces, rivers and lakes. Terrain types remain public. Unscouted resource scenery stays large; within one hex of troops/outposts it condenses. Upgraded provinces and owned roads extend scouting to two hexes. Production numbers appear within five hexes. The server masks remote ownership, troop counts, structures, rival resources, reserves and income breakdowns.

Optional models come from [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) and [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), both CC0. Original procedural scenery and infantry, archers and cavalry are bundled as fallbacks. See `ASSETS.md` for the art pipeline.

## Validation and project layout

`npm test` covers drafting, fog, shared-edge roads, bridges, production math, settlement upgrades, split placement, action locks, roll timing/idempotency, final-face/replay agreement, perimeter containment, buoyancy and terrain effects. The Socket.IO smoke test starts an isolated production server and plays two human clients through drafting, rolls, reinforcements and turn changes; it also checks a bot turn and reconnect replay.

- `shared/boardGeometry.js`: shared hex coordinates, edge/rock geometry and terrain profiles.
- `server/dicePhysics.js`: authoritative rigid-body simulation, recording and face detection.
- `server/realm.js`: game state, drafting, fog, reinforcement economy and action validation.
- `server/index.js`: rooms, roll completion timers, bots and realtime state delivery.
- `src/board.js`: Three.js map, troops, buildings, edge markers and perimeter rails.
- `src/dice.js`: in-board grab/throw input and authoritative replay interpolation.
- `src/main.js`, `src/style.css`: contextual turn controls and toggled HUD.

## Remaining prototype limits

Matches live in server memory and disappear on restart. Rooms have no account authentication, reconnect identity is only a session token, and the AI remains basic. Navy/shipyards/docks, trading and animated troop movement are not implemented; lakes block land armies, while bridges already unlock rivers. Combat remains server-resolved with numerical battle summaries rather than per-round physical replay on the map. Optional artwork is downloaded separately; full asset optimization and animation blending remain future work.
