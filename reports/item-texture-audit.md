# Voxelcraft item and texture audit

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

The complete absence list is [items-not-in-game.csv](items-not-in-game.csv). The list is based on canonical item definitions, not only direct PNG filenames: many valid Minecraft items are rendered from block models, layers, tints, or special renderers and therefore do not have a same-named file under `textures/item`.

## Texture installation

The supplied pack is included as `resourcepack.zip` beside `index.html`. Voxelcraft loads it automatically when served over HTTP, including through the workspace's local launcher or a static web host. The loader resolves the standard block and item PNGs and now also converts Java's special chest entity sheet into the three square chest faces used by Voxelcraft. The only atlas entry without a supplied texture is the intentional synthetic `missing` fallback tile.

## Items in the game

### Cube/block icons (72)

`minecraft:stone`, `minecraft:granite`, `minecraft:diorite`, `minecraft:andesite`, `minecraft:grass_block`, `minecraft:dirt`, `minecraft:cobblestone`, `minecraft:mossy_cobblestone`, `minecraft:stone_bricks`, `minecraft:sand`, `minecraft:gravel`, `minecraft:sandstone`, `minecraft:bedrock`, `minecraft:oak_log`, `minecraft:oak_planks`, `minecraft:oak_leaves`, `minecraft:birch_log`, `minecraft:birch_planks`, `minecraft:birch_leaves`, `minecraft:spruce_log`, `minecraft:spruce_planks`, `minecraft:spruce_leaves`, `minecraft:glass`, `minecraft:coal_ore`, `minecraft:iron_ore`, `minecraft:gold_ore`, `minecraft:redstone_ore`, `minecraft:lapis_ore`, `minecraft:diamond_ore`, `minecraft:emerald_ore`, `minecraft:coal_block`, `minecraft:iron_block`, `minecraft:gold_block`, `minecraft:diamond_block`, `minecraft:lapis_block`, `minecraft:redstone_block`, `minecraft:emerald_block`, `minecraft:crafting_table`, `minecraft:furnace`, `minecraft:chest`, `minecraft:white_wool`, `minecraft:orange_wool`, `minecraft:magenta_wool`, `minecraft:light_blue_wool`, `minecraft:yellow_wool`, `minecraft:lime_wool`, `minecraft:pink_wool`, `minecraft:gray_wool`, `minecraft:light_gray_wool`, `minecraft:cyan_wool`, `minecraft:purple_wool`, `minecraft:blue_wool`, `minecraft:brown_wool`, `minecraft:green_wool`, `minecraft:red_wool`, `minecraft:black_wool`, `minecraft:glowstone`, `minecraft:obsidian`, `minecraft:tnt`, `minecraft:bookshelf`, `minecraft:farmland`, `minecraft:dirt_path`, `minecraft:snow`, `minecraft:snow_block`, `minecraft:ice`, `minecraft:cactus`, `minecraft:pumpkin`, `minecraft:jack_o_lantern`, `minecraft:spawner`, `minecraft:netherrack`, `minecraft:end_stone`, `minecraft:redstone_lamp`

### Flat block icons (15)

`minecraft:oak_sapling`, `minecraft:birch_sapling`, `minecraft:spruce_sapling`, `minecraft:torch`, `minecraft:ladder`, `minecraft:dead_bush`, `minecraft:short_grass`, `minecraft:fern`, `minecraft:dandelion`, `minecraft:poppy`, `minecraft:cornflower`, `minecraft:oxeye_daisy`, `minecraft:redstone_torch`, `minecraft:lever`, `minecraft:oak_door`

### Standalone sprites (68)

`minecraft:stick`, `minecraft:coal`, `minecraft:charcoal`, `minecraft:iron_ingot`, `minecraft:gold_ingot`, `minecraft:diamond`, `minecraft:emerald`, `minecraft:redstone`, `minecraft:lapis_lazuli`, `minecraft:glowstone_dust`, `minecraft:gunpowder`, `minecraft:flint`, `minecraft:string`, `minecraft:feather`, `minecraft:leather`, `minecraft:bone`, `minecraft:book`, `minecraft:snowball`, `minecraft:wheat`, `minecraft:wheat_seeds`, `minecraft:egg`, `minecraft:paper`, `minecraft:sugar`, `minecraft:apple`, `minecraft:bread`, `minecraft:porkchop`, `minecraft:cooked_porkchop`, `minecraft:beef`, `minecraft:cooked_beef`, `minecraft:chicken`, `minecraft:cooked_chicken`, `minecraft:mutton`, `minecraft:cooked_mutton`, `minecraft:rotten_flesh`, `minecraft:carrot`, `minecraft:melon_slice`, `minecraft:wooden_pickaxe`, `minecraft:wooden_axe`, `minecraft:wooden_shovel`, `minecraft:wooden_hoe`, `minecraft:wooden_sword`, `minecraft:stone_pickaxe`, `minecraft:stone_axe`, `minecraft:stone_shovel`, `minecraft:stone_hoe`, `minecraft:stone_sword`, `minecraft:iron_pickaxe`, `minecraft:iron_axe`, `minecraft:iron_shovel`, `minecraft:iron_hoe`, `minecraft:iron_sword`, `minecraft:golden_pickaxe`, `minecraft:golden_axe`, `minecraft:golden_shovel`, `minecraft:golden_hoe`, `minecraft:golden_sword`, `minecraft:diamond_pickaxe`, `minecraft:diamond_axe`, `minecraft:diamond_shovel`, `minecraft:diamond_hoe`, `minecraft:diamond_sword`, `minecraft:shears`, `minecraft:flint_and_steel`, `minecraft:bucket`, `minecraft:water_bucket`, `minecraft:lava_bucket`, `minecraft:bow`, `minecraft:arrow`
