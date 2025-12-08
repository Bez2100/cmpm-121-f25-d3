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

**Current Status**: Architecture is correct, and Flyweight pattern is fully implemented. Only modified cells consume memory.

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
- [x] Scroll several screens away and return — verify modified cells restore perfectly
- [x] Ensure unmodified cells regenerate deterministically every time
- [x] Test edge cases:
  - [x] Pick up token, scroll far, scroll back → token should stay gone
  - [x] Combine tokens, scroll away, scroll back → combined token should persist
  - [x] Empty cell should stay empty if overridden with `null`
- [x] Confirm performance remains smooth with large render radius
- [x] Verify cellStates Map size stays small (only modified cells)

**Status**: All tests pass! D3.c is complete. ✅

---

## D3.d: Geolocation & Persistence — Implementation Plan

This document lists the required steps to implement geolocation-based movement,
localStorage persistence across page reloads, and a Facade pattern for movement control.

---

## Step 1 — Verify localStorage Persistence Works

- [x] Test that cellStates and heldToken are already persisting
- [x] Close the page, reopen it, verify game state is restored
- [x] Confirm `loadCellStates()` and `loadHeldToken()` are called on startup
- [x] Document in code that persistence is working as-is

**Result**: Foundation for D3.d persistence is already in place. ✅

**How it works:**

- On startup: `loadCellStates()` and `loadHeldToken()` restore from localStorage (lines 64-65)
- On every player action: `persistCellStates()` and `persistHeld()` save to localStorage (lines 311-312, 325-326, 338-339, 457-459)
- Player can close browser and reopen page — all state is preserved

---

## Step 2 — Create Movement Controller Facade Interface

- [x] Define `IMovementController` interface with methods:
  - [x] `activate(): void` — start listening for movement input
  - [x] `deactivate(): void` — stop listening
  - [x] `onPlayerMove: (callback: (lat: number, lng: number) => void) => void` — register callback
- [x] Keep interface in a separate section of code (not mixed with implementations)
- [x] Document that this hides button vs geolocation complexity from game code

**Result**: Clear abstraction layer for movement systems. ✅

**How it works:**

- Interface defined at lines 12-20 in `main.ts`
- Both ButtonMovementController and GeolocationMovementController will implement this
- Game code will call controller.activate() and register callback with onPlayerMove
- Each implementation handles its own movement logic internally

---

## Step 3 — Refactor Button Controls into Facade Implementation

- [x] Create `ButtonMovementController implements IMovementController`
- [x] Move keyboard/button event listeners into this class
- [x] Keep `movePlayerByCells()` function or similar internally
- [x] When button pressed, call callback with new coordinates
- [x] Game code should call controller methods, not keyboard handlers directly

**Result**: Button-based movement encapsulated in a clean implementation. ✅

**How it works:**

- `ButtonMovementController` class defined at lines 31-89 in `main.ts`
- Implements `IMovementController` interface with `activate()`, `deactivate()`, and `registerMoveCallback()`
- Constructor initializes keyboard listener internally
- Game code creates instance, registers callback, and calls `activate()` (lines 593-610)
- Old `movePlayerByCells()` function removed — logic moved into controller

---

## Step 4 — Implement Geolocation Movement Controller

- [x] Create `GeolocationMovementController implementing IMovementController`
- [x] Request permission from user: `navigator.geolocation.watchPosition()`
- [x] Define a "home location" (initial GPS coordinates) mapping to Null Island (0,0)
- [x] On each location update:
  - [x] Calculate distance from home in degrees (lat/lng difference)
  - [x] Convert to game cells using TILE_DEGREES
  - [x] Call callback with new game coordinates
- [x] Handle permission denied gracefully (show error message via flashMessage)
- [x] Handle geolocation errors (timeout, position unavailable, etc.)

**Result**: Real-world GPS movement working in game. ✅

**How it works:**

- `_GeolocationMovementController` class defined at lines 94-152 in `main.ts`
- Implements `IMovementController` interface with `activate()`, `deactivate()`, and `registerMoveCallback()`
- `activate()` calls `navigator.geolocation.watchPosition()` with success/error callbacks
- On first location: stores home location (initial GPS coordinates)
- On each update: calculates `deltaLat` and `deltaLng` from home, converts to game coordinates, fires callback
- `deactivate()` clears the watch and resets home location
- Error handling includes PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT cases
- High accuracy mode enabled (`enableHighAccuracy: true`) for best GPS precision

---

## Step 5 — Add Query String Mode Switching

- [x] Parse query string to detect `?movement=buttons` or `?movement=geolocation`
- [x] Default to `buttons` if not specified
- [x] Instantiate appropriate controller based on query string
- [x] Initialize only the selected controller
- [x] Document in UI which mode is active

**Result**: Player can choose movement mode via URL. ✅

**How it works:**

- `getMovementMode()` function (lines 653-663) parses `?movement=` query parameter
- Returns `"geolocation"` if present and matches, otherwise defaults to `"buttons"`
- Lines 666-668: Instantiate either `_GeolocationMovementController()` or `ButtonMovementController()` based on mode
- `updateMovementModeUI()` function (lines 671-680) displays active mode in status panel
- Game starts with correct controller activated, displaying mode to player

Usage Examples:

- Default button mode: `http://localhost:5173/` or `http://localhost:5173/?movement=buttons`
- Geolocation mode: `http://localhost:5173/?movement=geolocation`

---

## Step 6 — Add "New Game" UI Button

- [x] Add "New Game" button to control panel (separate from "Reset World")
- [x] "New Game" should:
  - [x] Clear cellStates completely
  - [x] Clear heldToken
  - [x] Reset player position to Null Island (0, 0)
  - [x] Clear localStorage
  - [x] Call `renderVisibleCells()` to redraw
  - [x] Show confirmation dialog to prevent accidents
- [x] "Reset World" continues to work as before (clears cells only, keeps position)

**Result**: Player can start completely fresh gameplay. ✅

**How it works:**

- `newGame()` function (lines 609-641 in `main.ts`) handles complete game reset
- Control panel now has two buttons: "Reset World" and "New Game" (lines 260-261)
- Shows confirmation dialog: "Start a new game? This will clear all progress and reset your position."
- Clears cellStates Map and localStorage completely
- Resets playerLatLng to ORIGIN (0,0)
- Rerenders visible cells and pans map to origin
- Difference from "Reset World":
  - Reset World: Only clears cellStates, keeps player position and inventory
  - New Game: Clears cellStates, localStorage, inventory, AND resets position to (0,0)

---

## Step 7 — Testing & Validation

- [x] Test button mode still works (backward compatibility)
- [x] Test geolocation mode:
  - [x] Grant permission, move around physically
  - [x] Verify character moves in game
  - [x] Deny permission, verify fallback or error message
- [x] Test localStorage persistence:
  - [x] Play, close browser, reopen page
  - [x] Verify all state is restored
- [x] Test mode switching:
  - [x] Load with `?movement=buttons`
  - [x] Load with `?movement=geolocation`
  - [x] Verify correct mode activates
- [x] Test New Game:
  - [x] Play, pick up tokens, place tokens
  - [x] Click "New Game"
  - [x] Confirm dialog appears
  - [x] Verify state is cleared, position reset to (0,0)
  - [x] Reload page, verify state stays cleared

**Result**: All D3.d features working correctly.

---
