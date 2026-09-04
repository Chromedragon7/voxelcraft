import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceRoot = path.resolve(
  projectRoot,
  '..',
  '..',
  'Minecraft_Clone_Master_Resources',
  '03_Item_Textures',
  'Unpacked_Vanilla_Item_Textures',
  'assets',
  'minecraft',
);

const cubeBlockItems = words(`
  stone granite diorite andesite grass_block dirt cobblestone mossy_cobblestone stone_bricks sand gravel sandstone bedrock
  oak_log oak_planks oak_leaves birch_log birch_planks birch_leaves spruce_log spruce_planks spruce_leaves glass
  coal_ore iron_ore gold_ore redstone_ore lapis_ore diamond_ore emerald_ore coal_block iron_block gold_block diamond_block
  lapis_block redstone_block emerald_block crafting_table furnace chest white_wool orange_wool magenta_wool light_blue_wool
  yellow_wool lime_wool pink_wool gray_wool light_gray_wool cyan_wool purple_wool blue_wool brown_wool green_wool red_wool
  black_wool glowstone obsidian tnt bookshelf farmland dirt_path snow snow_block ice cactus pumpkin jack_o_lantern spawner
  netherrack end_stone redstone_lamp
`);

const flatBlockItems = words(`
  oak_sapling birch_sapling spruce_sapling torch ladder dead_bush short_grass fern dandelion poppy cornflower oxeye_daisy
  redstone_torch lever oak_door
`);

const standaloneItems = words(`
  stick coal charcoal iron_ingot gold_ingot diamond emerald redstone lapis_lazuli glowstone_dust gunpowder flint string
  feather leather bone book snowball wheat wheat_seeds egg paper sugar apple bread porkchop cooked_porkchop beef cooked_beef
  chicken cooked_chicken mutton cooked_mutton rotten_flesh carrot melon_slice wooden_pickaxe wooden_axe wooden_shovel wooden_hoe
  wooden_sword stone_pickaxe stone_axe stone_shovel stone_hoe stone_sword iron_pickaxe iron_axe iron_shovel iron_hoe iron_sword
  golden_pickaxe golden_axe golden_shovel golden_hoe golden_sword diamond_pickaxe diamond_axe diamond_shovel diamond_hoe
  diamond_sword shears flint_and_steel bucket water_bucket lava_bucket bow arrow
`);

const gameItems = [...cubeBlockItems, ...flatBlockItems, ...standaloneItems];
const uniqueGameItems = new Set(gameItems);
assert(gameItems.length === 155, `expected 155 game items, found ${gameItems.length}`);
assert(uniqueGameItems.size === gameItems.length, 'duplicate item in the Voxelcraft audit inventory');

const itemDefinitionNames = (await readdir(path.join(referenceRoot, 'items')))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -5))
  .sort();
const canonicalItems = new Set(itemDefinitionNames);
assert(itemDefinitionNames.length === 1537, `expected 1,537 Java 26.2 item definitions, found ${itemDefinitionNames.length}`);

for (const name of gameItems) assert(canonicalItems.has(name), `game item is missing from the Java 26.2 definitions: ${name}`);

const directItemTextures = new Set(
  (await readdir(path.join(referenceRoot, 'textures', 'item')))
    .filter((name) => name.endsWith('.png'))
    .map((name) => name.slice(0, -4)),
);
for (const name of standaloneItems) assert(directItemTextures.has(name), `standalone game item is missing its direct PNG: ${name}`);
assert(directItemTextures.has('oak_door'), 'oak_door is missing its direct inventory PNG');

const language = JSON.parse(await readFile(path.join(referenceRoot, 'lang', 'en_us.json'), 'utf8'));
const absent = itemDefinitionNames.filter((name) => !uniqueGameItems.has(name));
assert(absent.length === 1382, `expected 1,382 items outside Voxelcraft, found ${absent.length}`);

const reportsDir = path.join(projectRoot, 'reports');
await mkdir(reportsDir, { recursive: true });
await writeFile(
  path.join(reportsDir, 'items-not-in-game.csv'),
  ['canonical_id,display_name', ...absent.map((name) => csvRow(`minecraft:${name}`, displayName(name)))].join('\n') + '\n',
);

await writeFile(
  path.join(reportsDir, 'item-texture-audit.md'),
  `# Voxelcraft item and texture audit

Source baseline: Minecraft Java Edition 26.2 item definitions and textures supplied with this workspace.

## Result

| Measure | Count |
|---|---:|
| Java 26.2 item definitions checked | 1,537 |
| Items implemented in Voxelcraft | 155 |
| Java items not implemented in Voxelcraft | 1,382 |
| Implemented cube/block icons | 72 |
| Implemented flat block icons | 15 |
| Implemented standalone item sprites | 68 |
| Implemented item IDs with a matching Java 26.2 definition | 155 / 155 |
| Standalone sprites with a matching direct item PNG | 68 / 68 |

The complete absence list is [items-not-in-game.csv](items-not-in-game.csv). The list is based on canonical item definitions, not only direct PNG filenames: many valid Minecraft items are rendered from block models, layers, tints, or special renderers and therefore do not have a same-named file under \`textures/item\`.

## Texture installation

The supplied pack is included as \`resourcepack.zip\` beside \`index.html\`. Voxelcraft loads it automatically when served over HTTP, including through the workspace's local launcher or a static web host. The loader resolves the standard block and item PNGs and now also converts Java's special chest entity sheet into the three square chest faces used by Voxelcraft. The only atlas entry without a supplied texture is the intentional synthetic \`missing\` fallback tile.

## Items in the game

### Cube/block icons (${cubeBlockItems.length})

${inlineIds(cubeBlockItems)}

### Flat block icons (${flatBlockItems.length})

${inlineIds(flatBlockItems)}

### Standalone sprites (${standaloneItems.length})

${inlineIds(standaloneItems)}
`,
);

console.log(`Wrote ${absent.length} absent items and audited ${gameItems.length} implemented items.`);

function displayName(name) {
  return language[`item.minecraft.${name}`] ?? language[`block.minecraft.${name}`] ?? name.split('_').map(capitalize).join(' ');
}

function capitalize(value) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function words(value) {
  return value.trim().split(/\s+/);
}

function inlineIds(items) {
  return items.map((name) => `\`minecraft:${name}\``).join(', ');
}

function csvRow(...values) {
  return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
