# RISKAGON — The Frontier Update (v0.2)

Riskagon is an original browser-based multiplayer hex strategy game that combines territory warfare, provincial development and resource dice. Its isometric 3D world uses Three.js, a Socket.IO authoritative multiplayer server and real Cannon-es physics dice.

## Open the updated build in GitHub Codespaces

For an **existing Codespace**, pull the latest commit before starting:

```bash
git pull origin main
npm install
npm run assets:sync
npm run dev
```

For a **new Codespace**: Code → Codespaces → Create codespace on `main`; dependencies and 22 free KayKit assets install through `postCreateCommand`. Then run `npm run dev`. Open forwarded port **3000**. Set that port's visibility to **Public** if friends outside the repository need access to the match; do not expose sensitive classroom/personal information, as rooms presently lack authentication.

```bash
npm test
npm run build
```

## How to play

1. **Create a realm**, share its link, add one or more AI kingdoms if you want to play without friends.
2. **Draft a banner** in player order (blue/red/green/yellow), then **draft starting homelands** in reverse order. All homelands start with **3 troops, 1 outpost, 1 wood/brick/wheat/sheep and 0 ore**.
3. At the start of your turn, **drag one of the 3D dice and release it into the rolling tray**, which has gravity, collision walls and angular momentum. The server resolves the dice fairly and the simulated dice settle on the authoritative faces. The button underneath is an accessible keyboard/touch fallback.
4. Provincial resources produce **only** when their dice number is rolled. Upgrade buildings in that province to produce more resources, fortify defenses, gain troops, or accumulate movement.
5. **Click an owned hex** to zoom in and open its building catalog. **Build Road** highlights shared border edges in gold: click the desired edge, not the center of a tile. Roads cost 1 wood + 1 brick and halve the cost of crossing that border.
6. Choose **March / Attack** from an occupied hex, then click an adjacent destination. Armies must leave at least one garrison at the source. Combat uses attacker-versus-defender dice with ties awarded to defenders, and battle rolls are visualized with the physics dice.
7. **Deploy free reinforcements** at an outpost or settlement, starting in **round 2**: 2 units per kingdom per turn. The first round has zero free reinforcements, so players cannot rush with a nine-unit opening army. The first to **32 victory points** wins.

## Fog of war

- The **resource type of every tile stays visible** so players can plan long-term territory expansion. Unscouted tiles use a larger natural prop scale.
- A province becomes **scouted** within **one hex** of your troops/outposts. The terrain props shrink to leave room for troops and buildings, including neighboring rivals.
- An upgraded owned province or completed road extends your scouting radius to **two hexes**.
- A tile's **production number** is revealed within **five hexes** of your troops/outposts.
- Far-away rival ownership, army counts, buildings and other players' inventories are sanitized on the server rather than merely hidden in CSS. Team colors and the public victory-point scoreboard remain visible.

## Province buildings

A new province has no building. Construct an **outpost** before you can upgrade it or deploy troops there. Every outpost supports up to **four additional upgrades**. Upgrades trigger when that province's number is rolled.

| Construction | Cost | Effect when number is rolled |
| --- | --- | --- |
| Outpost | 1 wood, 1 brick | Enables construction and deployment |
| Homes | 2 wood, 1 brick, 1 wheat | +1 native resource |
| Walls | 2 brick, 1 ore | Store +1 defense charge (max 3); permanent defensive bonus while standing |
| Armory | 2 ore, 1 brick | Store +1 attacker bonus (max 3) |
| Farm (fields) | 2 wood, 1 wheat | +2 wheat |
| Lumberyard (forest) | 1 wood, 1 brick | +2 wood |
| Quarry (hills) | 1 wood, 2 brick | +2 brick |
| Mine (mountains) | 2 wood, 1 ore | +2 ore |
| Ranch (pasture) | 1 wood, 2 sheep | +2 sheep |
| Barracks | 2 wood, 2 brick, 1 ore | +2 troops on that tile |
| Stables | 2 wood, 2 wheat, 1 sheep | Store +1 movement point (max 2) |
| Bridge (river tile) | 2 wood, 1 brick, 1 ore | Allows land armies to cross the bridged river hex |

## What has shipped

- 91-hex map with resource provinces, river and lake water tiles, team drafting, fog of war and large-to-small scenery transitions.
- 3D procedural colored soldiers, archers, and mounted troops, in a compatible low-poly visual style.
- 3D dice rigid bodies with interactive click/hold/drag/release, collision walls, physics bounces, and server-authoritative turn/combat rolls.
- River bridge construction and crossing rules. Lake hexes block land troops.
- Responsive kingdom controls and zoomed construction view, realtime turn log, multiplayer rooms and basic AI.
- Server-side action validation and tests for draft order, privacy, reinforcements, bridges and resource buildings.

## Planned water/navy system (not yet playable)

Lakes are blocked to land troops. The next phase will introduce:

1. **Shipyards** built on an owned coastal outpost adjoining a lake; these create a separate naval troop reserve on matching dice rolls.
2. **Naval movement** between neighboring lake hexes, with ships retaining a water-only path.
3. **Docks** built on the bank of a controlled lake tile, creating legal landing points for amphibious assaults.
4. **Transport capacity and amphibious combat**, with units embarked onto ships and landed at docking sites.
5. **River crossings** already work through bridge construction in this release; later versions can add an alternate ferry option.

These mechanics will be server-validated rather than simulated solely in the browser.

## Project files

- `server/realm.js`: new 91-hex game model, drafting, fog, economy, combat and water crossing rules.
- `server/index.js`: Express / Socket.IO room and bot orchestration.
- `server/realm.test.js`: new rules tests.
- `src/board.js`: large 3D hex board, roads, river bridges, fog and province structures.
- `src/troops.js`: original infantry, archer and cavalry meshes (no asset dependency).
- `src/dice.js`: Cannon-es rigid body dice, visible pips, grab/throw/replay.
- `src/main.js`, `src/style.css`: multiplayer UI and building menus.
- `scripts/sync-kaykit.mjs`: KayKit CC0 texture/model asset sync; generated files are ignored from Git.
- `ASSETS.md`: research and longer-term licensed art pipeline.

## Licensing & prototype limitations

The included asset importer uses [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) (CC0-1.0). Troop meshes are original code geometry so no character-license dependency is required. [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) is recommended as the next animation-ready character import.

**Important limitations**: No permanent saved matches, account authentication, spectator mode, trading market, navy/shipyards, or full visual asset optimization yet. The dice have actual client-side rigid-body physics and player-directed throws, but the server determines trusted outcomes, so pushing the dice does not let a client manipulate resource or combat odds.
