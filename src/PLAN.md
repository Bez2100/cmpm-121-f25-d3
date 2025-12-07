# D3: World

## D3.a: Core Mechanics (Token Collection and Crafting)

### Steps

#### 1. Setup + Reset Starter

- [x] Create PLAN.md
- [x] Delete everything in `src/main.ts`
- [x] Verify `luck.ts` and `leafletworkaround.ts` remain untouched
- [x] Import Leaflet + luck into fresh `main.ts`
- [x] Create basic DOM layout (inventory display, map container)

#### 2. Map Initialization

- [x] Center map on classroom coordinates (fixed position)
- [x] Disable user panning so the player believes map extends infinitely
- [x] Add a marker representing player location

#### 3. Grid System

- [x] Define fixed cell size (0.0001 degrees)
- [x] Write function to compute cell coordinates around the player
- [x] Draw visible grid cells on map (use rectangles or canvas overlays)
- [x] Ensure grid extends beyond view boundaries (feels infinite)

#### 4. Deterministic Token Generation

- [x] Use luck("cell-x-y") to generate a value for each cell
- [x] Decide token spawn rules (e.g., 30% chance to have 1-value token)
- [x] Render token content visibly on each cell (text or graphic)
- [x] Ensure token value is identical across page loads

#### 5. Interaction Constraints

- [x] Detect clicks on cells
- [x] Allow interaction only if cell is within 3 cells of player
- [x] Show feedback for distant cells (e.g., “too far away”)

#### 6. Inventory

- [x] Track whether player is holding exactly one token or none
- [x] Update UI to show: “Inventory: empty” or “Holding token value X”
- [x] When picking up a token, remove it from the cell (in memory)
- [x] Ensure removal persists via in-memory session state (no need for saving)

#### 7. Crafting

- [x] If player holds a token and clicks a cell:
- [x] If cell has same value → combine into value * 2
- [x] Update cell + inventory state
- [x] Re-render updated token
- [x] Detect when player reaches target value (e.g., 8 or 16)

#### 8. Polish / Testing

- [x] Verify all coordinate math is consistent
- [x] Ensure deterministic behavior on reload
- [x] Adjust UI so all information is clearly visible
- [x] Confirm entire grid is visible without scrolling

D3.b: Globe-Spanning Gameplay — Implementation Plan

This document lists the required steps to extend the D3.a world into a
globe-spanning, scrollable environment with player movement and dynamic cell loading.

## Step 1 — Convert coordinate system to Null Island

- [x] Replace CLASSROOM_LATLNG with (0, 0)
- [x] Base all cell calculations on this global origin
- [x] Enable full map dragging/scrolling (remove movement restrictions)

---

## Step 2 — Add player state & player marker

- [x] Add `playerLatLng` variable storing current player position
- [x] Render player marker at that position
- [x] Center the map on the player at startup

---

## Step 3 — Add movement buttons (N/S/E/W)

- [x] Add UI buttons for North / South / East / West
- [x] Each button moves player by exactly one TILE_DEGREES step
- [x] Map recenters on new player position after movement

---

## Step 4 — Grid rendering tied to map movement

- [x] Add `map.on("moveend")` listener
- [x] Compute which cells are visible inside the viewport bounding box
- [x] Render only visible cells
- [x] Remove old `renderAllAround()` global draw

---

## Step 5 — Memoryless cells beyond view

- [x] Cells despawn when leaving visible screen
- [x] Spawning uses deterministic luck unless overridden
- [x] Returning to a previously seen cell respawns it fresh if not overridden
- [x] **REFACTORED**: Replaced `overrides` Record with `cellStates` Map for better persistence

---

## Step 6 — Update interaction radius centered on player

- [x] Compute player's cell coordinates (pi, pj)
- [x] Allow interactions only if:
      abs(i - pi) ≤ INTERACTION_RADIUS_CELLS
      abs(j - pj) ≤ INTERACTION_RADIUS_CELLS

---

## Step 7 — Update click handler to use real player position

- [x] Modify `handleCellClick` to compare against player cell
- [x] Preserve existing pickup / place / crafting behaviors
- [x] Validate interaction after coordinate change

---

## Step 8 — Update win condition

- [x] Confirm win triggers when crafting reaches target
- [x] Confirm win triggers when held token reaches target

---

## Step 9 — Final consistency & polish

- [x] Verify rendering performance under scrolling
- [x] Ensure no orphaned markers remain
- [x] Ensure player movement stays synced with rendering
- [x] Ensure infinite grid illusion is intact

---

## D3.c: Object Persistence — Implementation Plan

This document lists the required steps to implement persistent cell state
using the Flyweight and Memento patterns, while maintaining an infinite,
scrollable world

---

## Step 1 — Flyweight Pattern (Memory Efficiency)

- [x] Do **not** store any data for unmodified cells
- [x] Use deterministic RNG (`luck()`) to compute default cell values on demand
- [x] **BUG FIXED**: Removed `cellStates.set(k, token)` from `initialTokenForCell()` — now only modified cells are stored
- [x] Store only modified cells in a single Map/Record object
- [x] Key the map using `"i,j"` so lookup is O(1)
- [x] Ensure that unmodified cells do not create marker/rect objects until rendered

**Result:**\
Only visible cells or modified cells consume memory.

**Current Status**: Architecture is correct, but implementation leaks memory by storing unmodified cells.

---

## Step 2 — Memento Pattern (Storing Modified Cells)

- [x] Treat each modified cell as a "memento" snapshot of its state
- [x] Save modifications to the `cellStates` Map:
  - [x] `number` → the stored token value
  - [x] `null` → explicitly empty
- [x] Ensure `initialTokenForCell()` always checks cellStates first (for modified cells)
- [x] Modified cells in cellStates regenerate identically when re-entering view
- [x] Avoid storing transient markers/rectangles—only store logical state
- [x] **FIX APPLIED**: Only write to cellStates when player modifies a cell
  - [x] `handleCellClick()` — already correct (only writes on action)
  - [x] `initialTokenForCell()` — FIXED (no longer writes unmodified cells)

**Result:**\
Modified cells behave as if they "remember" changes forever. Unmodified cells don't pollute the Map.

---

## Step 3 — Rebuild Visible Screen Region Dynamically

- [x] Do **not** maintain a single giant board in memory
- [x] Every render cycle:
  - [x] Compute visible cells in viewport bounding box
  - [x] Render each cell based on cellStates (modified) + deterministic logic (unmodified)
- [x] Don't try to "move" markers when the map pans
- [x] Rebuild display from scratch on each moveend event (redraw philosophy)

**Result:**\
Scrolling and zooming never break the illusion of an infinite world.

---

## Step 4 — Persistent Behavior (Within a Session Only)

- [x] Modified cells persist even if the player scrolls far away
- [x] Persistence across page reloads is **not** required yet (that's D3.d)
- [x] `resetWorld()` clears the cellStates map
- [x] After reset, all cells return to deterministic values
- [x] **VERIFIED**: Modified cells now persist correctly without storing unmodified cells

**Result:**\
Cells remember their state during gameplay but not across reloads.

---

## Step 5 — Testing & Validation

- [x] **FIXED**: Removed `cellStates.set(k, token)` from `initialTokenForCell()`
- [ ] Scroll several screens away and return — verify modified cells restore perfectly
- [ ] Ensure unmodified cells regenerate deterministically every time
- [ ] Test edge cases:
  - [ ] Pick up token, scroll far, scroll back → token should stay gone
  - [ ] Combine tokens, scroll away, scroll back → combined token should persist
  - [ ] Empty cell should stay empty if overridden with `null`
- [ ] Confirm performance remains smooth with large render radius
- [ ] Verify cellStates Map size stays small (only modified cells)

**Current blockers:**

- Line 174 in `main.ts`: `cellStates.set(k, token)` violates Flyweight pattern
  - This line stores every unmodified cell, defeating the memory optimization
  - Solution: Delete this line — unmodified cells don't need storage

---
