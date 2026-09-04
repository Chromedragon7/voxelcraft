# Voxelcraft player mechanics reconstruction contract

This document describes the player mechanics in the active Fable 5.1 **Voxelcraft** fork. It is intended to let another LLM reproduce the existing behavior without reading all of the 4,000+ line `index.html` file.

The source of truth is `../index.html`, especially:

- lines 756–772: mining time and harvest rules;
- lines 2560–2844: physics, input, player movement, survival, damage, death, and respawn;
- lines 2848–3110: targeting, mining, use, placement, attack, and item dropping;
- lines 3535–3660: dropped items, arrows, and explosion damage;
- lines 3810–3990: mob attacks and player-to-mob raycasts;
- lines 4400–4560: save fields and menu wiring;
- lines 4620–4680: fixed survival tick and per-frame game loop.

This is a description of **Voxelcraft as implemented**, not a specification for vanilla Minecraft. Section 14 separates behavior that should be preserved for an exact remake from shortcomings that may be changed in a parity-focused rewrite.

## 1. Runtime and coordinate model

Voxelcraft is a browser game using Three.js. The complete game lives in one HTML file.

- World units are block units: one block is `1 × 1 × 1`.
- The player position `(x, y, z)` is the horizontal center of the feet.
- The player collider is an upright AABB.
- `w` is half-width, not total width.
- Y increases upward.
- Yaw `0` faces negative Z.
- Positive pitch looks upward.
- Rendering uses a right-handed Three.js scene.

The player begins with these physical values:

| Property | Value | Meaning |
| --- | ---: | --- |
| half-width | `0.3` | total collider width and depth are `0.6` |
| height | `1.8` | feet-to-head collider height |
| standing eye height | `1.62` | camera and ray origin above feet |
| sneaking eye height | `1.27` | visual/raycast eye height only |
| step height | `0.6` | maximum automatic step-up |
| gravity | `32` | blocks/s² |
| terminal fall speed | `78` | blocks/s downward |
| jump velocity | `8.4` | blocks/s upward |

Important: sneaking changes `eyeHeight`, but it does **not** change the current `h = 1.8` collider. A literal remake must preserve that behavior.

## 2. Two clocks

Do not merge the two timing paths when making a literal reconstruction.

### Per-render-frame path

The following run once per animation frame while the game is ready and unpaused:

1. `Player.update(dt)`
2. chunk streaming
3. zero or more fixed game ticks
4. `Interaction.update(dt)`
5. dropped entities and projectiles
6. mob movement and animation
7. particles and weather presentation
8. camera and HUD

Frame `dt` is capped at `0.05` seconds during play. Movement, gravity integration, collision, mouse look, mining progress, eating progress, attack/use cooldowns, player damage immunity time, and FOV easing all use this frame delta.

### Fixed 20 Hz path

`TICK_DT` is `0.05` seconds. The game accumulates render-frame time and executes at most four fixed ticks per rendered frame. The fixed tick runs:

1. scheduled world updates;
2. `Player.tick()` survival bookkeeping;
3. random block ticks;
4. weather tick;
5. tick subscribers such as mob AI and spawning.

As a result, movement is not actually fixed-timestep even though survival is. An exact remake should retain this split. A more robust rewrite can move authoritative motion into the fixed tick and interpolate the camera.

## 3. Input state

The input manager stores:

```text
keys: map from KeyboardEvent.code to held boolean
buttons: mouse buttons 0, 1, 2 as held booleans
dx, dy: accumulated relative mouse movement
wheel: accumulated signed wheel steps
locked: whether the game canvas owns pointer lock
```

Behavior:

- A first keydown emits a one-shot `keypress`; repeated keydown events only keep the key held.
- Keyup clears that key.
- Window blur clears all keys and mouse buttons.
- Losing pointer lock clears input and normally opens pause.
- Mouse movement is accumulated only while pointer locked.
- Mouse wheel changes the selected hotbar slot only while controls are active.
- Controls are active only when pointer locked, no inventory/container screen is open, and the game is not paused.
- Mouse sensitivity is `0.0022` radians per reported pixel.
- Pitch is clamped to `[-π/2 + 0.01, +π/2 - 0.01]`.
- Yaw is not wrapped.

Default bindings relevant to the controller:

| Input | Action |
| --- | --- |
| W/S | forward/backward |
| A/D | strafe left/right |
| Space | jump, swim upward, climb, or fly upward |
| Shift | sneak, stop on ladder, or fly downward |
| Ctrl | begin sprint while moving forward |
| double-tap W within 300 ms | begin sprint |
| double-tap Space within 300 ms | toggle creative flight |
| mouse left | attack a mob or mine a block |
| mouse right | eat, use, or place |
| wheel / 1–9 | select hotbar slot |
| Q / Ctrl+Q | drop one / drop whole selected stack |
| F | creative pick block |
| G | toggle survival/creative |

## 4. Player state

An equivalent implementation needs at least this state:

```text
position: x, y, z
velocity: vx, vy, vz
collider: w, h, stepHeight
view: yaw, pitch, eyeHeight
contacts: onGround, hitX, hitZ
environment: inWater, headInWater, inLava, onLadder
locomotion: flying, sneaking, sprinting
vitals: health, maxHealth, hunger, saturation, exhaustion, air, fire
timers: regenTimer, starveTimer, hurtTimer, damageTimer, ticksAlive
fall tracking: fallStart
input gestures: lastSpaceTap, lastWTap
life: dead, spawn, lastHurtBy
inventory: 36 slots and selected hotbar index
```

Initial survival values are 20 health, 20 hunger, 5 saturation, 0 exhaustion, 300 air, and 0 fire ticks.

## 5. Environment sampling

Before movement each frame, sample the block definition at the following positions:

```text
feet = floor(x), floor(y + 0.1), floor(z)
body = floor(x), floor(y + 0.9), floor(z)
eye  = floor(x), floor(y + eyeHeight), floor(z)
```

Then derive:

```text
inWater    = feet is water OR body is water
headInWater = eye is water
inLava     = feet is lava OR body is lava
onLadder   = feet is climbable OR body is climbable
```

These are point samples, not collider-volume fluid queries. They are evaluated before this frame's movement, so entering a fluid is observed on the following frame.

## 6. Horizontal movement

Create local input `(mx, mz)` from A/D and W/S. If its length is nonzero, normalize it. This prevents diagonal movement from being faster.

Convert local input to world space:

```text
forward = (-sin(yaw), 0, -cos(yaw))
right   = ( cos(yaw), 0, -sin(yaw))
worldX  = forward.x * mz + right.x * mx
worldZ  = forward.z * mz + right.z * mx
```

Target horizontal speeds:

| State | Speed in blocks/s |
| --- | ---: |
| walk | `4.317` |
| sprint | `5.612` |
| sneak | `1.31` |
| water | `2.2` |
| lava | `1.2` |
| ladder | `2.0` |
| creative flight | `10.9` |
| sprinting creative flight | `21.0` |

State priority in the code is important. Flight overrides sneak and fluid speed. When not flying, water/lava overrides walking, sprinting, and sneaking. Ladder speed is used only when not flying and not in water/lava.

Velocity approaches the target with exponential smoothing:

```text
rate = flying ? 8 : onGround ? 18 : inWater ? 6 : 3
k = 1 - exp(-rate * dt)
vx += (worldX * speed - vx) * k
vz += (worldZ * speed - vz) * k
```

This gives strong ground control, weak air control, and softer water control. If a horizontal collision occurs, the corresponding velocity component is set to zero after movement.

## 7. Sprint, sneak, and flight state machines

### Sprint

Sprint begins when either:

- Ctrl is held while forward input is positive and hunger is above 6; or
- W is double-tapped within 300 ms while hunger is above 6.

Once started, sprint persists without holding Ctrl as long as forward remains held. It stops when forward input is zero/negative, the player sneaks, controls deactivate, or hunger reaches 6 or lower.

There is no sprint-swim speed boost: fluid speed overrides the sprint speed. The sprint flag can remain true in water, so it can still affect FOV and exhaustion.

### Sneak

Sneak is the held state of either Shift key. It:

- targets 1.31 blocks/s on land;
- changes eye height to 1.27 when not flying;
- cancels sprint;
- activates edge protection after collision movement;
- stops downward ladder movement;
- becomes the fly-down input in creative flight.

It does not shrink the collider and cannot enter a 1.5-block-high passage.

### Creative flight

Double-tapping Space within 300 ms toggles flight only in creative mode. Switching to survival turns flight off.

Flight vertical velocity approaches a target using rate 10:

```text
verticalIntent = jumpHeld - sneakHeld
targetY = verticalIntent * (sprinting ? 16 : 8)
vy += (targetY - vy) * (1 - exp(-10 * dt))
```

Horizontal flight uses 10.9 or 21 blocks/s. If the player is grounded and requests downward flight, flight turns off.

## 8. Vertical movement

### Air and ground

If jump is held while grounded, set `vy = 8.4`, clear `onGround`, and add exhaustion:

- normal jump: `0.05`;
- sprint jump: `0.2`.

Then apply gravity in the same frame:

```text
vy = max(vy - 32 * dt, -78)
```

Jump is level-triggered, not edge-triggered. Holding Space causes another jump whenever the player becomes grounded; there is no explicit repeat delay.

### Water and lava

While jump is held:

```text
vy = min(vy + 30 * dt, 4)
```

Otherwise:

```text
vy = max(vy - 10 * dt, inLava ? -1.5 : -3)
```

Then apply approximate vertical damping:

```text
vy *= 1 - 2 * dt
```

If grounded in fluid while jump is held, force `vy = 4` to hop out.

### Ladder

- Space or W: `vy = 2.35`.
- Shift: `vy = 0`.
- Otherwise gravity applies, clamped to `-2.35`.

## 9. Collision and stepping

### World collision boxes

Collision operates on block collision boxes, not only full cubes. A solid full cube contributes its unit cube. Shaped solid blocks contribute every box returned by `blockBoxes(def, meta)`. Non-solid blocks contribute nothing.

Unloaded generated terrain is treated as full solid blocks, preventing the player from walking into unloaded chunks. A synthetic floor from Y -2 to 0 is added below the world.

### Axis-separated sweep

For requested displacement `(dx, dy, dz)`:

1. collect nearby block boxes with one block of padding;
2. clip Y and apply it;
3. mark grounded and zero `vy` if downward Y was clipped;
4. clip X and apply it;
5. clip Z and apply it;
6. set `hitX` and `hitZ` when requested horizontal movement was clipped.

Each axis sweep compares the player interval with every candidate whose other two axes overlap. An epsilon of `0.0001` separates touching faces.

### Step-up

If X or Z was blocked, the entity was grounded before or after the Y move, `stepHeight > 0`, and stepping is not disabled:

1. restore the horizontal start position;
2. sweep upward by as much as `stepHeight` permits;
3. retry full X and Z movement at that height;
4. sweep downward by the amount moved up;
5. keep the stepped route only if it travels farther horizontally and finds support before descending the full raised distance.

The player always uses a step height of 0.6.

### Sneak edge protection

After normal/step movement, if the player was grounded, is sneaking, and would now be airborne, query for support within 0.6 blocks below the final AABB. If no support exists, restore the starting X/Z and force grounded state.

This is an all-or-nothing rollback. It does not progressively trim each horizontal axis to the ledge, so it is simpler and more abrupt than Minecraft's edge behavior.

## 10. Falling and fall damage

`fallStart` stores the greatest recent player Y while airborne.

Reset `fallStart` to current Y while grounded, in water, on a ladder, or flying. When transitioning from airborne to grounded outside those safe states:

```text
distance = fallStart - currentY
if distance > 3 and not creative:
    damage(floor(distance - 3), "fell from a high place")
```

This is height based, not impact-velocity based. Water, ladders, and flight cancel the accumulated fall. Creative mode ignores it.

## 11. Camera and FOV

Camera position and orientation are assigned directly every frame:

```text
camera.position = (x, y + eyeHeight, z)
camera.rotation = (pitch, yaw, 0) using YXZ order
```

There is no head bob, hurt tilt, camera interpolation, third person, or collision camera.

FOV targets:

| State | FOV |
| --- | ---: |
| normal | `70` degrees |
| sprinting | `80` degrees |
| sprinting while flying | `90` degrees |

FOV eases per frame:

```text
fov += (target - fov) * min(1, dt * 8)
```

The projection matrix is updated only when current camera FOV differs by more than 0.05 degrees.

## 12. Targeting and actions

### Reach and target selection

- Survival reach: `4.5` blocks.
- Creative reach: `6.0` blocks.
- The same reach is used for blocks and mobs.
- Ray origin is the current eye position.
- Ray direction comes from yaw and pitch.

Block targeting uses 3D DDA through voxel cells, up to 200 steps. Full blocks are accepted from the cell crossing. Shaped blocks get an exact ray/AABB test against their collision boxes. Blocks with empty collision boxes get an approximate inset selection box. Liquids are skipped unless the held item is the empty bucket.

Mob targeting ray-tests every living mob AABB and chooses the nearest one before the nearest block. If a mob wins, the block target is cleared.

### Left mouse: attack or mine

Priority is:

1. attack targeted mob;
2. otherwise mine targeted block;
3. otherwise clear mining progress.

Mining progress is attached only to block coordinates. Changing tools while holding the same target does not reset accumulated progress.

### Mining time

The implemented formula returns seconds:

```text
unbreakable hardness < 0          => Infinity
hardness == 0                    => 0.05
base speed                       => 1
correct tool kind                => tool.speed
sword on cross/crop              => 1.5
shears on leaves                 => 15
cannot harvest required material => hardness * 5
otherwise                        => hardness * 1.5 / speed
```

Progress increases by `dt / breakTime`. Reaching 1 removes the block, spawns drops if harvestable, damages the held tool, and adds `0.005` exhaustion. Creative breaks instantly with a short repeat guard.

### Player attack

Holding left mouse attacks again whenever the cooldown expires.

- Empty hand damage: `1`.
- Item damage: the item's `damage` property.
- Axe cooldown: `1.0` second.
- All other item/hand cooldowns: `0.6` second.
- Knockback: forward vector × 6 horizontally, plus `3.5` upward.
- Non-shears tools lose durability on a successful attack call.
- Each attack adds `0.1` exhaustion.

There is no partial cooldown damage, critical hit, sweep attack, sprint knockback branch, armor calculation, shield, or separate entity reach.

### Right mouse: eat, use, place

Priority while held:

1. if held item is food and hunger is below 20 (or mode is creative), eat;
2. otherwise, once every 0.25 seconds, use the targeted mob/block/item;
3. place if the held item is a block and no earlier action consumes the use.

Eating takes 1.6 seconds of continuous right-click. Completion adds the food's hunger and saturation, clamps both, and consumes one item.

Block use checks interactive blocks first unless sneaking. It then handles doors and levers, then item-specific behavior such as buckets, hoes, seeds, flint and steel, and bows, and finally placement.

Placement derives its position from a replaceable target or the hit-face neighbor. It validates world height, replaceability, liquid restrictions, block-specific support/orientation, two-block door room, and exact player/mob overlap for solid collision boxes. A successful survival placement consumes one item and adds `0.005` exhaustion.

### Dropping and pick block

Q drops one selected item. Ctrl+Q drops the selected stack. The item spawns 0.5 blocks along look direction and 0.3 below the eye, with velocity `look × 6` plus `1.5` upward and a 40-tick pickup delay.

Creative pick-block selects an existing matching hotbar stack; otherwise it replaces the selected slot with a count-one stack.

## 13. Survival, damage, death, and save behavior

### Hunger

Per fixed tick, if exhaustion is at least 4, subtract exactly 4 once, then subtract 1 saturation if any remains, otherwise 1 hunger.

Exhaustion sources implemented for the player:

| Action | Exhaustion |
| --- | ---: |
| normal jump | `0.05` |
| sprint jump | `0.2` |
| sprinting | `speed × dt × 0.1` per frame |
| break block | `0.005` |
| place block | `0.005` |
| attack | `0.1` |
| take accepted damage | `0.1` |
| baseline drain | `0.5` every 1,200 ticks / 60 s |
| heal 1 health naturally | `6.0` |

At hunger 18 or more and below max health, regenerate 1 health every 80 ticks (4 seconds). At hunger 0, take 1 damage every 80 ticks until health reaches 1. Difficulty is not modeled.

Creative mode forces health to maximum and hunger to 20 every survival tick.

### Air, fire, and contact damage

- Air begins at 300 ticks.
- Head underwater removes 1 air per tick.
- Out of water restores 4 air per tick, capped at 300.
- After air reaches zero, a further 20 submerged ticks cause 2 drowning damage and reset air to zero; this repeats each second.
- Lava sets fire to 300 ticks and attempts 4 damage every 10 ticks.
- Water immediately clears fire.
- Burning attempts 1 damage every 20 ticks.
- Every 10 ticks, overlapping cactus attempts 1 damage; overlapping fire sets 160 fire ticks and attempts 1 damage.

### Damage immunity

Accepted player damage sets a 0.5-second `damageTimer`. Any further damage while it is positive is discarded outright, regardless of whether the new hit is stronger. The timer decreases in per-frame interaction update, not in the fixed survival tick.

Accepted damage also:

- subtracts health;
- sets a 0.3-second hurt visual timer;
- adds 0.1 exhaustion;
- stores the text cause;
- adds an optional knockback vector directly to velocity;
- triggers the red damage flash.

Creative and dead players reject damage.

### Death and respawn

On death:

1. set dead and clamp health to zero;
2. spawn every one of the 36 inventory stacks as a dropped item with random horizontal velocity and +3 vertical velocity;
3. clear every inventory slot;
4. release pointer lock;
5. show the death screen and cause text.

Respawn uses the stored `spawn` tuple, resets position, velocity, health, hunger, saturation, exhaustion, air, fire, fall tracking, and damage immunity, hides the death screen, refreshes the hotbar, and reacquires pointer lock.

### Persisted player fields

The save stores:

```text
x, y, z, yaw, pitch,
health, hunger, saturation,
inventory, hotbar, spawn, flying
```

It does not store velocity, exhaustion, air, fire, damage timers, fall start, grounded/contact flags, sprinting, sneaking, environment flags, or time alive. Those return to reset/default values when loading.

## 14. Literal remake versus improved remake

Tell the implementing LLM which target is wanted.

### Literal Voxelcraft remake

Preserve all of these, even where they differ from vanilla Minecraft:

- per-frame movement and interaction with 20 Hz survival bookkeeping;
- fixed 1.8-high collider while sneaking;
- point-sampled fluids;
- target-speed exponential acceleration;
- 6-block creative reach and shared block/entity reach;
- mining progress surviving a tool swap;
- simplified mining seconds formula;
- fixed full-damage attack cooldowns;
- all-or-nothing sneak ledge rollback;
- 0.5-second damage immunity that drops every later hit;
- baseline passive hunger drain;
- only the listed save fields.

### Parity-focused improvement

Keep the same controls and game feel, but fix these in order:

1. Move authoritative player motion to the 20 Hz fixed tick; render an interpolated camera.
2. Add explicit poses and collider sizes, including crouch headroom checks and a true crouching collider.
3. Replace point fluid sampling with collider-volume immersion and eye-fluid tests.
4. Make movement coefficients depend on surface friction, fluid drag, status effects, item use, and block speed factors.
5. Make sneak edge safety trim displacement instead of restoring the entire X/Z move.
6. Track fall distance from allowed vertical displacement rather than a high-water Y marker.
7. Split block and entity reach and raycast selection shapes separately from collision shapes.
8. Key mining progress by target, tool/stack identity, mode, and interruption state.
9. Implement the tick-quantized hardness formula and modifiers.
10. Replace attack lockouts with attack-strength charge, critical/sweep rules, armor, and proper invulnerability comparison.
11. Remove baseline hunger drain and add missing action-specific exhaustion.
12. Persist every authoritative field or explicitly derive/reset it during load.

## 15. Minimal reconstruction pseudocode

```text
animationFrame(now):
    dt = min(0.05, secondsSinceLastFrame)
    if playing and ready and not paused:
        updatePlayer(dt)
        updateChunks()

        tickAccumulator += dt
        repeat while tickAccumulator >= 0.05, at most 4 times:
            tickAccumulator -= 0.05
            fixedGameTick()

        updateInteraction(dt)
        updateDroppedEntitiesAndProjectiles(dt)
        updateMobMotionAndAnimation(dt)

    camera.position = player.feet + (0, player.eyeHeight, 0)
    camera.rotation = (player.pitch, player.yaw, 0)
    easeFov(dt)
    render()

updatePlayer(dt):
    readAndConsumeMouseLook()
    sampleFeetBodyAndEyeBlocks()
    readMovementKeysAndUpdateSprintSneak()
    normalizeLocalMovementInput()
    rotateInputByYaw()
    chooseSpeedAndControlRate()
    exponentiallyApproachHorizontalVelocity(dt)
    updateVerticalVelocityForFlightFluidLadderOrAir(dt)
    moveAabbYThenXThenZWithStepAndSneakSafety(dt)
    zeroBlockedHorizontalVelocity()
    updateFallTrackingAndLandingDamage()
    addSprintExhaustion(dt)
    setFovTarget()

fixedGameTick():
    runScheduledWorldUpdates()
    updateAirFireContactHungerRegenerationAndStarvation()
    runRandomBlockTicks()
    tickWeather()
    tickMobAIAndSpawning()

updateInteraction(dt):
    reduceUseAttackAndDamageCooldowns(dt)
    raycastBlockAndMobFromEye()
    if leftHeld:
        attackMobElseMineBlock(dt)
    if rightHeld:
        eatElseUseElsePlace(dt)
```

## 16. Acceptance tests for another LLM

A remake should not be accepted based only on visual similarity. At minimum, automate or manually verify:

1. Standing collider is 0.6 × 1.8 and the camera is 1.62 above feet.
2. Sneaking changes the eye to 1.27, slows land motion, and prevents a ledge fall, but does not fit under a 1.5-block ceiling in literal mode.
3. Diagonal input is normalized.
4. Ground, air, water, ladder, and flight controls converge at visibly different rates.
5. Walk, sprint, sneak, water, lava, ladder, flight, and sprint-flight target speeds match the table.
6. Holding jump repeatedly jumps after each landing.
7. A slab/shape at or below 0.6 can be stepped onto; a full block cannot.
8. Unloaded chunks behave as solid boundaries.
9. Water or a ladder cancels pending fall damage.
10. Sprint starts via Ctrl+W and double-tap W, and stops at hunger 6.
11. Creative flight toggles only via a sub-300 ms Space double tap.
12. Survival/creative reach is 4.5/6 and the nearest mob blocks mining of a farther block.
13. Mining changes speed by tool kind/speed and preserves progress across a tool swap.
14. Axes attack once per second; everything else attacks every 0.6 seconds.
15. Eating requires 1.6 seconds of continuous right-click.
16. A second source of damage inside 0.5 seconds is fully ignored.
17. Air lasts 15 seconds before the one-second drowning grace period.
18. Natural regeneration and starvation each use 80-tick intervals.
19. Death drops and clears all 36 inventory slots.
20. Save/load restores only the documented player fields.

## 17. Copyable implementation instruction

Use the following as the task prompt for another coding model:

> Recreate the player mechanics described in `docs/PLAYER_MECHANICS_RECONSTRUCTION.md` inside this Voxelcraft project. Treat `index.html` as the behavioral oracle. First implement a literal compatibility version, including the split per-frame/fixed-tick timing, then add deterministic tests for every acceptance item. Do not silently replace Voxelcraft behavior with generic Minecraft assumptions. Keep player collider, eye position, selection ray, block collision shapes, and camera as separate concepts. Preserve the existing controls, HUD contracts, inventory calls, block registry calls, and entity interfaces. If you intentionally choose an improvement from section 14, place it behind a named compatibility option and test both modes.

