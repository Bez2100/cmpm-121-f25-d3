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

- [ ] Detect clicks on cells
- [ ] Allow interaction only if cell is within 3 cells of player
- [ ] Show feedback for distant cells (e.g., “too far away”)

#### 6. Inventory

- [ ] Track whether player is holding exactly one token or none
- [ ] Update UI to show: “Inventory: empty” or “Holding token value X”
- [ ] When picking up a token, remove it from the cell (in memory)
- [ ] Ensure removal persists via in-memory session state (no need for saving)

#### 7. Crafting

- [ ] If player holds a token and clicks a cell:
- [ ] If cell has same value → combine into value * 2
- [ ] Update cell + inventory state
- [ ] Re-render updated token
- [ ] Detect when player reaches target value (e.g., 8 or 16)

#### 8. Polish / Testing

- [ ] Verify all coordinate math is consistent
- [ ] Ensure deterministic behavior on reload
- [ ] Adjust UI so all information is clearly visible
- [ ] Confirm entire grid is visible without scrolling
