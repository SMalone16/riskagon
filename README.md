# RISKAGON

**A multiplayer, isometric hex strategy game combining resource development and territory warfare.** Build kingdoms with Catan-inspired resources. March armies and capture territory with Risk-inspired dice combat.

## Launch in GitHub Codespaces

1. Open this repository in a Codespace. It installs dependencies automatically.
2. Run `npm run dev` in the terminal.
3. Open the forwarded port **3000** (make it shareable with your friends if desired).
4. Create a room, invite others using the room link, or use **Add AI kingdom** for a quick test.
5. Host presses **Begin conquest**. Every turn, roll, build, recruit, march, then end turn.

Local: `npm install && npm run dev`. Tests: `npm test`. Production: `npm run build && npm start`.

### Gameplay (MVP rule set)

- **19 randomized hexes:** forest produces wood, hills produce brick, fields produce wheat, pasture produces sheep, mountains produce ore; desert produces none.
- **Buildings and soldiers occupy tiles; roads occupy shared sides of neighboring hexes.** Each owned terrain produces on matching dice rolls, whether built or not. Settlements/fortresses increase production.
- **Road** costs 1 wood + 1 brick. **Settlement** 1 each wood, brick, wheat, sheep. **Fortress** 2 ore + 1 brick + 1 wheat. **Recruit 2** costs 1 ore + 1 sheep, at a building.
- Two mobility points per turn. Marching across your road costs 0.5 mobility; other marches cost 1. Leave a garrison of at least 1 in the source tile.
- Moving into neutral tiles claims them. Battles use up to three attacker dice vs up to two defender dice, ties to defenders, rounds until one side is defeated. Owned roads boost highest attacker die; fortresses boost defender die. Captured fortifications lose one level.
- First kingdom to **13 points** wins. Each territory is 1 point; each settlement adds 1; each fortress adds 2.
- **Important:** These are original hybrid rules, not a faithful implementation of Catan or Risk. The starter is a prototype: room data lives in server memory, no authentication, no persistence/replay and resources are currently public. Do not expose unrestricted write access to an untrusted audience.

### Art direction and assets

Our primary art pipeline is **[KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0)** (CC0 1.0). Its free core includes buildings, landscape, roads and nature props with 4 color variants. Install a curated selection with:

```bash
npm run assets:sync
```

The game runs **before assets are installed** using original procedural low-poly scenery. After installing, the renderer progressively replaces compatible buildings, trees, rocks and mountains with local KayKit glTF models. The game never depends on a third-party CDN for its game assets at runtime.

**Other researched CC0 options**
- [Kenney Hexagon Kit](https://kenney.nl/assets/hexagon-kit): 70+ 3D models.
- [Kenney Hexagon Tiles](https://kenney.nl/assets/hexagon-tiles): 90+ 2D sprite files.
- [Artyom Zagorskiy Isometric Medieval Pack](https://artyom-zagorskiy.itch.io/isometric-medieval-pack): 269 2D/vector tiles.

The expanded KayKit unit pack is not part of the free core; troops are generated in Three.js for now. See `ASSETS.md`.

### Source

- `server/game.js` pure, tested rules and combat
- `server/index.js` Express + Socket.IO rooms, actions, bots, and Vite
- `src/board.js` Three.js isometric board and interaction
- `src/main.js` responsive lobby, kingdom control panel, HUD
- `scripts/sync-kaykit.mjs` CC0 assets fetcher with license metadata

Roadmap: browser-friendly drag-and-drop trading, ports, robber/bandit, diplomatic treaties, objective cards, animations, persisted multiplayer and proper account security.
