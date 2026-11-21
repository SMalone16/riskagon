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

On The Frontier, reach **32 victory points** through territory, buildings and upgrades. Open **Rules** during play for more detail.

## Local development

Use Node.js 20 or later. Run `npm ci` and `npm run dev`, then open `http://localhost:3000`. The board includes fallback art and bundled Miami models. Run `npm run assets:sync` for optional medieval models. Use `npm test` to check the rules and multiplayer flow, and `npm run build` for the production client. Rooms live in server memory and end when the server stops.

Invite links prefill the room code. Each new player enters a name and clicks **Join**. During play, the side panel follows the current phase. Matching tiles celebrate after the dice settle, and each owner sees their own earnings fly into the treasury.

A turn starts at 60 seconds. Each territory after the first adds two seconds, each pair of troops above three adds one (rounded up), and every five banked resources add one, up to 150 seconds. Running out of legal orders passes play immediately. At timeout, an unmade roll is skipped, an in-flight roll finishes, and unplaced reinforcements go to an owned outpost or settlement before play passes.

## Biscayne Dice Enterprise

Biscayne uses its own organization draft, economy, and victory condition. **First to $15,000 in lifetime dice sales wins.** Cash from a base finances expansion. Only dice sales advance the victory track.

1. **Secure supply.** Start with $1,600, two of each building material, two Dice Rock and two Dice Compound. Matching Pine Rocklands produce one rock and Everglades one compound. Every activated owned tile also yields its building material. An organization base pays $200 per activation, or $400 after expansion.
2. **Refine.** Build a **Keyside Pulverizer** on Keys to grind one rock into one dust. Build **Shoreline Binder Works** on beach to turn one compound into one glue. Raw inputs are shared across your organization. Refined stock stays at the site.
3. **Ship.** Select the refinery and its shipment button to send its stock to an owned Miami **Dice Lab**. Connect the sites with owned roads or with beach/island docks linked by open water. Land legs to the docks need roads. Enemy fleet occupation breaks a water route.
4. **Cast and equip.** One dust and one glue make one finished die at the lab. Equipping consumes one die. Grade one colors your dice. Every grade above one adds +1 to each attack and defense die, including naval battles and police defense.
5. **Sell.** Batches of 1, 2, 4 or 8 pay $500, $1,200, $3,000 or $10,000. The treasury can spend site earnings, and police can seize cash and stock still held on a raided site.

| Construction or recruitment | Base price | Materials |
| --- | ---: | --- |
| Organization base | $100 | 1 lumber, 1 concrete |
| Expand base | $180 | 2 lumber, 1 concrete |
| Recruitment office | $120 | 1 lumber, 1 hardware |
| Keyside Pulverizer | $100 | 1 hardware, 1 concrete |
| Shoreline Binder Works | $100 | 1 lumber, 1 fiber |
| Dice Lab | $200 | 2 concrete, 1 hardware |
| Cargo Dock | $80 | 1 lumber, 1 aggregate |
| Skiff | $90 | 1 lumber |
| Hire one member | $100 | 1 fiber |

The displayed cash quote includes missing ingredients. Each missing unit costs $25–$120 according to its pooled supply relative to the average material supply. Held ingredients are spent first. The two refineries and lab cost $400 in base fees. The opening inventory covers all but one concrete if nothing else has been purchased.

**Police calls.** A seven pauses the normal clock and targets another organization with an open approach. Calls start at two officers and add two each time. The patrol and three adjacent hexes, including its target, become public. The target has 30 seconds per tile to roll defense or split every member among adjacent friendly destinations. Silence defaults to defense. Officers move together, clear captured sites and continue into connected target territory until defeated or the trail ends.

Press **↑** or **Biscayne Wire** for illustrated action posts and police bulletins. Scrolling the phone holds your reading position for five seconds after the last wheel movement.
