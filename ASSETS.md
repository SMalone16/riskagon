# Riskagon asset selection & implementation

**Chosen visual system:** 3D low-poly orthographic/isometric, matte colors, simple rounded UI.

## Primary — KayKit Medieval Hexagon (free core)

- Original: https://kaylousberg.com/game-assets/medieval-hexagon
- GitHub source: https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
- License: CC0 1.0. The free core contains ~200 hex tiles, buildings and props, 4 team colors; the extended characters/units are an optional separately distributed pack.
- Formats: glTF/FBX, single gradient material atlas per models.
- `npm run assets:sync` installs **22 selected glTF models**, their referenced `.bin` buffers, textures, and the CC0 license into `public/assets/kaykit/`. Generated download assets are gitignored to keep the repository lean.
- Renderer automatically discovers local manifest. If absent, all assets fall back to procedural Three.js art (no broken-image placeholders).
- At runtime all models are served by the same Codespaces origin; nothing downloads from KayKit servers during play.

## Troops and resource objects — recommended additions

- **[KayKit Adventurers Character Pack](https://kaylousberg.com/game-assets/characters-adventurers)**: Free CC0 core has five animated/rigged characters and more than 25 weapons. The knight is a strong starting point for infantry, while bow/crossbow accessories support ranged-unit variants. Models need scale/instancing work for the hex board; not yet integrated into gameplay.
- **[KayKit Character Animations](https://kaylousberg.com/game-assets/character-animations)**: Free CC0 walk, attack, death, idle and hit animations for future battle presentation.
- **[KayKit Resource Bits](https://kaylousberg.itch.io/resource-bits)**: Free CC0 wood, stone, ore, gold and crafted resource models; useful for the treasury and production popups.
- **KayKit Medieval Hexagon EXTRA tier**: Includes dedicated RTS units (not part of the free core), more coherent visually than mixing unrelated character styles. Review paid-tier terms and availability on the official KayKit pack page before acquisition.

## Alternatives (do not mix art styles without color grading)

| Pack | License | Best for |
| --- | --- | --- |
| https://kenney.nl/assets/hexagon-kit | CC0 | Hex terrain variations, castles and paths; 70+ low-poly 3D models |
| https://kenney.nl/assets/hexagon-tiles | CC0 | 2D/vector illustrations and 90+ tiles |
| https://kenney.nl/assets/hexagon-buildings | CC0 | 2D settlement sprites |
| https://artyom-zagorskiy.itch.io/isometric-medieval-pack | CC0 | 269 vector/SVG isometric medieval tiles; viable flat renderer |
| https://quaternius.com/ | Check pack license | Additional troops and medieval props; curate and verify version-specific terms |

## Art integration rules

- **Tiles**: 19 pointy-top hexes at axial `x = sqrt(3)*(q+r/2), z=1.5*r`. Tiles are resource and territory containers.
- **Roads**: canonical, unique edge IDs between two *adjacent* hexes. A timber road mesh physically follows the shared border. Do not replace with center-to-center tracks.
- **Buildings**: one structure per tile, colored by faction. Extra troops use compact soldier silhouettes next to the structure; entire tile stays clickable.
- **Terrain**: mountain, tree, farm, pasture, hill props are decoration, not separately clickable. Keep their proportions under 40% of hex footprint.
- **Future art**: render or import lightweight GLBs for warriors, archers, cavalry, ships, siege units. For mobile keep meshes instanced and materials shared.
- **Legal**: while CC0 is permissive, keep the source, version and license record with any vendored assets. Avoid copying the copyrighted Catan/Risk visual identity, logos or official art.
