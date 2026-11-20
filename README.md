# Riskagon

## Start in GitHub Codespaces

1. On GitHub, open **Code → Codespaces → Create codespace on main**. Wait for setup to install dependencies.
2. In the Codespace terminal, run `npm run dev`.
3. Open **Ports → 3000 → Open in Browser**. Enter your commander name and choose **Create a realm**.
4. To invite classmates, set port **3000** to **Public** if your organization permits it, then use **Copy invite link** in the lobby. Keep the Codespace running during play. You can also fill empty seats with AI.

## Set up a match

**2–8 kingdoms** share a board. The host uses the arrows beside the board to choose a map. Everyone sees the terrain layout that will launch. Larger lobbies get a larger board so even the last player has room to settle.

| Map | What you’ll see |
| --- | --- |
| The Frontier | Forests, wheat fields, pastures, clay hills and iron mountains around a lake and river. |
| Biscayne & the Keys | A randomized South Florida coastline with pine rocklands (wood), Everglades (sheep), Miami (ore), beaches (brick), island keys (wheat) and navigable ocean. |

Each AI receives a private, randomly assigned play style. Draft banner colors in joining order, then pick homelands in reverse. **Any hex at least four hex steps from every earlier homeland is eligible.** Every kingdom starts with an outpost and three soldiers. Water picks become productive islands. An isolated island also gets a dock, a neighboring boat and enough materials for a landing dock.

## Play a turn

- **Roll.** Drag and release a die or click **Roll dice**. Everyone watches the same throw. Matching tiles produce resources.
- **Reinforce.** From round two, allocate available troops to outposts and settlements, then confirm. Production bonuses earned on other turns wait for your next deployment.
- **Give orders.** Select a territory to move troops, attack or build. Leave a garrison when marching. Roads stretch movement, walls protect borders, and gates let friendly armies through.
- **Expand and trade.** Scout to reveal other kingdoms and taverns. Trade with adjacent kingdoms, build industries and settlements, or use shipyards and docks to move armies by sea.

Reach **32 victory points** through territory, buildings and upgrades. Open **Rules** during play for more detail.

## Local development

Use Node.js 20 or later. Run `npm ci` and `npm run dev`, then open `http://localhost:3000`. The board includes fallback art and bundled Miami models. Run `npm run assets:sync` for optional medieval models. Use `npm test` to check the rules and multiplayer flow, and `npm run build` for the production client. Rooms live in server memory and end when the server stops.

Invite links prefill the room code. Each new player enters a name and clicks **Join**. During play, the side panel follows the current phase. Matching tiles celebrate after the dice settle, and each owner sees their own earnings fly into the treasury.

A turn starts at 60 seconds. Each territory after the first adds two seconds, each pair of troops above three adds one (rounded up), and every five banked resources add one, up to 150 seconds. Running out of legal orders passes play immediately. At timeout, an unmade roll is skipped, an in-flight roll finishes, and unplaced reinforcements go to an owned outpost or settlement before play passes.
