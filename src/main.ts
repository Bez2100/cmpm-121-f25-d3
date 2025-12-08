// @deno-types="npm:@types/leaflet"
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css"; // keep your stylesheet for layout (create if missing)

// keep these two starter files as-is in the project root / src
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

/* -------------------------
   D3.d: Movement Controller Facade Interface
   -------------------------*/
// This interface abstracts the movement mechanism (buttons vs geolocation)
// Game code depends on this interface, not on specific implementations
interface IMovementController {
  // Start listening for movement input
  activate(): void;

  // Stop listening for movement input
  deactivate(): void;

  // Register callback to be called when player moves
  // Callback receives new player coordinates (lat, lng)
  registerMoveCallback(callback: (lat: number, lng: number) => void): void;
}

/* -------------------------
   D3.d: Button Movement Controller Implementation
   -------------------------*/
class ButtonMovementController implements IMovementController {
  private moveCallback: ((lat: number, lng: number) => void) | null = null;
  private keydownHandler: ((ev: KeyboardEvent) => void) | null = null;

  registerMoveCallback(callback: (lat: number, lng: number) => void): void {
    this.moveCallback = callback;
  }

  activate(): void {
    this.keydownHandler = (ev: KeyboardEvent) => {
      const key = ev.key;
      let handled = true;
      let di = 0;
      let dj = 0;

      switch (key) {
        case "ArrowUp":
        case "w":
        case "W":
          di = 1;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          di = -1;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          dj = -1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dj = 1;
          break;
        default:
          handled = false;
      }

      if (handled && this.moveCallback) {
        // Calculate new position based on cell movement
        const newLat = playerLatLng.lat + di * TILE_DEGREES;
        const newLng = playerLatLng.lng + dj * TILE_DEGREES;
        this.moveCallback(newLat, newLng);
        ev.preventDefault();
      }
    };

    globalThis.addEventListener("keydown", this.keydownHandler);
  }

  deactivate(): void {
    if (this.keydownHandler) {
      globalThis.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}

/* -------------------------
   D3.d: Geolocation Movement Controller Implementation
   -------------------------*/
class _GeolocationMovementController implements IMovementController {
  private moveCallback: ((lat: number, lng: number) => void) | null = null;
  private watchId: number | null = null;
  private homeLocation: { lat: number; lng: number } | null = null;

  registerMoveCallback(callback: (lat: number, lng: number) => void): void {
    this.moveCallback = callback;
  }

  activate(): void {
    if (!navigator.geolocation) {
      flashMessage("Geolocation not supported by this browser.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // On first location, establish home location at Null Island origin
        if (!this.homeLocation) {
          this.homeLocation = { lat: latitude, lng: longitude };
          flashMessage("Geolocation active. Home location set.");
        }

        // Calculate delta from home location
        const deltaLat = latitude - this.homeLocation.lat;
        const deltaLng = longitude - this.homeLocation.lng;

        // Convert GPS delta to game coordinates
        // Each TILE_DEGREES represents one cell move
        const gameLat = ORIGIN.lat + deltaLat;
        const gameLng = ORIGIN.lng + deltaLng;

        if (this.moveCallback) {
          this.moveCallback(gameLat, gameLng);
        }
      },
      (error) => {
        let msg = "Geolocation error: ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg += "Permission denied.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg += "Position unavailable.";
            break;
          case error.TIMEOUT:
            msg += "Request timed out.";
            break;
          default:
            msg += "Unknown error.";
        }
        flashMessage(msg);
        console.warn(msg, error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  deactivate(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.homeLocation = null;
    }
  }
}

/* -------------------------
   UI: build DOM placeholders
   -------------------------*/
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

/* -------------------------
   Constants / tuning
   -------------------------*/
const ORIGIN = L.latLng(0, 0); // Null Island
let playerLatLng = ORIGIN.clone(); // start at Null Island
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4; // cell side in degrees (≈ size of a house)
const INTERACTION_RADIUS_CELLS = 3; // can interact within 3 cells
const _RENDER_RADIUS_CELLS = 120; // draw many cells so map looks infinite
const SPAWN_PROBABILITY = 0.30; // deterministic chance a cell initially has a token
const TARGET_VALUE = 16; // win when player holds >= this

/* -------------------------
   Emoji mapping (Option 1)
   -------------------------*/
const EMOJI_BY_VALUE: Record<number, string> = {
  1: "🌱",
  2: "🌿",
  4: "🍀",
  8: "✨",
  16: "💎",
  32: "🔥",
  64: "🌈",
  128: "⚡",
  256: "🌟",
};

/* -------------------------
   Persistence keys
   -------------------------*/
// D3.d: localStorage persistence is fully implemented below
// Game state (cellStates and heldToken) automatically persists across page reloads
const STORAGE_CELL_STATES = "wob_cell_states_v1"; // cell state map
const STORAGE_HAND = "wob_hand_v1";

/* -------------------------
   In-memory state
   -------------------------*/
// cellStates: Map where key is "i,j" and value is the token currently in that cell (or null if empty)
// This persists cell state across the entire session—cells remember their state even when off-screen
const cellStates: Map<string, number | null> = loadCellStates();
let heldToken: number | null = loadHeldToken();

// Map of rendered objects to allow updates
const rects = new Map<string, L.Rectangle>();
const markers = new Map<string, L.Marker>();

/* -------------------------
   Initialize map
   -------------------------*/
const map = L.map(mapDiv, {
  center: ORIGIN,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  dragging: true, // doesn't prevent panning so player believes grid covers world
  scrollWheelZoom: true,
  doubleClickZoom: true,
  boxZoom: true,
  keyboard: true,
  touchZoom: true,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Player overlay (fixed to viewport center) — visually separates player from map panning
const playerOverlay = document.createElement("div");
playerOverlay.id = "playerOverlay";
playerOverlay.innerHTML = `<div class="player-icon">🧍</div>`;
mapDiv.append(playerOverlay);

/* -------------------------
   Control / Status UI
   -------------------------*/
function makeControlUI() {
  controlPanelDiv.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; padding:8px;">
      <div id="inventory" style="min-width:180px;">Inventory: ...</div>
      <button id="resetBtn">Reset World</button>
      <button id="newGameBtn">New Game</button>
      <div id="msg" style="margin-left:8px;color:#222;"></div>
    </div>
  `;
  (document.getElementById("resetBtn") as HTMLButtonElement).addEventListener(
    "click",
    resetWorld,
  );
  (document.getElementById("newGameBtn") as HTMLButtonElement).addEventListener(
    "click",
    newGame,
  );
  updateInventoryUI();
}
makeControlUI();

// Status panel: show player coords & brief controls
function updateStatusUI() {
  statusPanelDiv.innerHTML = `Player: <strong>${playerLatLng.lat.toFixed(5)}, ${
    playerLatLng.lng.toFixed(5)
  }</strong> — Move with arrow keys / WASD. Shift+click map to teleport.`;
}
updateStatusUI();

/* -------------------------
   Coordinate helpers
   -------------------------*/
function _cellCoordsForLatLng(
  lat: number,
  lng: number,
): { i: number; j: number } {
  const origin = ORIGIN;
  const i = Math.floor((lat - origin.lat) / TILE_DEGREES);
  const j = Math.floor((lng - origin.lng) / TILE_DEGREES);
  return { i, j };
}

function boundsForCell(i: number, j: number): L.LatLngBounds {
  const origin = ORIGIN;
  const sw = L.latLng(
    origin.lat + i * TILE_DEGREES,
    origin.lng + j * TILE_DEGREES,
  );
  const ne = L.latLng(
    origin.lat + (i + 1) * TILE_DEGREES,
    origin.lng + (j + 1) * TILE_DEGREES,
  );
  return L.latLngBounds(sw, ne);
}

function centerForCell(i: number, j: number): L.LatLng {
  const b = boundsForCell(i, j);
  return b.getCenter();
}

function keyFor(i: number, j: number) {
  return `${i},${j}`;
}

/* -------------------------
   Deterministic spawn logic
   -------------------------*/
function initialTokenForCell(i: number, j: number): number | null {
  const k = keyFor(i, j);

  // If we've visited this cell before (player modified it), return its stored state
  if (cellStates.has(k)) {
    return cellStates.get(k) ?? null;
  }

  // Otherwise, compute deterministically using luck (don't store unmodified cells)
  const p = luck(`cell-${i}-${j}-spawn`);
  if (p < SPAWN_PROBABILITY) {
    return 1;
  }
  return null;
}

/* -------------------------
   Rendering functions
   -------------------------*/
function renderCell(i: number, j: number) {
  const key = keyFor(i, j);
  const bounds = boundsForCell(i, j);

  // Create rectangle if needed
  let rect = rects.get(key);
  if (!rect) {
    rect = L.rectangle(bounds, {
      color: "#666",
      weight: 1,
      fillOpacity: 0.0,
      interactive: true,
    }).addTo(map);

    rect.on("click", () => handleCellClick(i, j));
    rects.set(key, rect);
  } else {
    rect.setBounds(bounds);
  }

  // Compute token value (either override or deterministic)
  const val = initialTokenForCell(i, j);

  // Create or update marker that shows token emoji + numeric value
  let marker = markers.get(key);
  if (val != null) {
    const emoji = EMOJI_BY_VALUE[val] ?? EMOJI_BY_VALUE[1];
    const content =
      `<div style="text-align:center; font-size:18px; line-height:1;">${emoji}<div style="font-size:12px;">${val}</div></div>`;
    const icon = L.divIcon({
      className: "cell-token",
      html: content,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const center = centerForCell(i, j);
    if (!marker) {
      marker = L.marker(center, { icon, interactive: true }).addTo(map);
      marker.on("click", () => handleCellClick(i, j));
      markers.set(key, marker);
    } else {
      marker.setLatLng(center);
      marker.setIcon(icon);
    }
  } else {
    // no token — remove marker if present
    if (marker) {
      marker.remove();
      markers.delete(key);
    }
  }
}

/* -------------------------
   Bulk render cells based on viewport
   -------------------------*/
// Render only cells currently visible in the map viewport (on moveend)
function renderVisibleCells() {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Determine cell indices covering the viewport
  const c1 = _cellCoordsForLatLng(sw.lat, sw.lng);
  const c2 = _cellCoordsForLatLng(ne.lat, ne.lng);
  // Add a 1-cell padding so tokens near the edges don't pop while panning
  const paddingCells = 1;
  const iMin = Math.min(c1.i, c2.i) - paddingCells;
  const iMax = Math.max(c1.i, c2.i) + paddingCells;
  const jMin = Math.min(c1.j, c2.j) - paddingCells;
  const jMax = Math.max(c1.j, c2.j) + paddingCells;

  const keep = new Set<string>();

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const k = keyFor(i, j);
      keep.add(k);
      renderCell(i, j);
    }
  }

  // Remove rectangles/markers that are no longer visible
  for (const k of Array.from(rects.keys())) {
    if (!keep.has(k)) {
      const r = rects.get(k)!;
      r.remove();
      rects.delete(k);
    }
  }
  for (const k of Array.from(markers.keys())) {
    if (!keep.has(k)) {
      const m = markers.get(k)!;
      m.remove();
      markers.delete(k);
    }
  }
}

// Render initially and whenever the map finishes moving
renderVisibleCells();
map.on("moveend", renderVisibleCells);

/* -------------------------
   Interaction / game logic
   -------------------------*/
function withinInteraction(i: number, j: number): boolean {
  const { i: ci, j: cj } = _cellCoordsForLatLng(
    playerLatLng.lat,
    playerLatLng.lng,
  );
  return Math.abs(i - ci) <= INTERACTION_RADIUS_CELLS &&
    Math.abs(j - cj) <= INTERACTION_RADIUS_CELLS;
}

function handleCellClick(i: number, j: number) {
  const key = keyFor(i, j);
  if (!withinInteraction(i, j)) {
    flashMessage("Too far away to interact.");
    return;
  }

  const current = initialTokenForCell(i, j); // reads cellStates
  // Case A: pick up (have nothing in hand, cell has token)
  if (heldToken === null && current != null) {
    // pick it up
    heldToken = current;
    cellStates.set(key, null); // remove from cell
    persistCellStates();
    persistHeld();
    updateInventoryUI();
    renderCell(i, j);
    flashMessage(
      `Picked up ${heldToken} (${EMOJI_BY_VALUE[heldToken] ?? "?"})`,
    );
    return;
  }

  // Case B: place into empty cell
  if (heldToken != null && current == null) {
    cellStates.set(key, heldToken);
    heldToken = null;
    persistCellStates();
    persistHeld();
    updateInventoryUI();
    renderCell(i, j);
    flashMessage(`Placed token in cell ${i},${j}.`);
    return;
  }

  // Case C: crafting (held token equal to cell token)
  if (heldToken != null && current === heldToken) {
    const newVal = heldToken * 2;
    cellStates.set(key, newVal);
    heldToken = null;
    persistCellStates();
    persistHeld();
    updateInventoryUI();
    renderCell(i, j);
    flashMessage(`Combined into ${newVal} (${EMOJI_BY_VALUE[newVal] ?? ""})`);
    // check win if needed (also win if player holds >= target)
    if (newVal >= TARGET_VALUE) {
      showWin(newVal);
    }
    return;
  }

  // Case D: nothing to do
  flashMessage("No valid action for this cell.");
}

/* -------------------------
   Inventory / UI helpers
   -------------------------*/
function updateInventoryUI() {
  const inv = document.getElementById("inventory")!;
  if (heldToken == null) {
    inv.innerHTML = `Inventory: <strong>empty</strong>`;
  } else {
    const emoji = EMOJI_BY_VALUE[heldToken] ?? "";
    inv.innerHTML = `Inventory: <strong>${emoji} ${heldToken}</strong>`;
    // also detect win if hand reached target
    if (heldToken >= TARGET_VALUE) {
      showWin(heldToken);
    }
  }
}

function flashMessage(msg: string, ms = 1600) {
  const el = document.getElementById("msg")!;
  el.textContent = msg;
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = "";
  }, ms);
}

function showWin(value: number) {
  // Simple overlay message
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.backgroundColor = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "9999";
  overlay.innerHTML =
    `<div style="background:white;padding:20px;border-radius:10px;text-align:center;">
    <h2>YOU WIN 🎉</h2>
    <p>You made a ${value} token ${EMOJI_BY_VALUE[value] ?? ""}!</p>
    <button id="closeWin">Close</button>
  </div>`;
  document.body.append(overlay);
  (document.getElementById("closeWin") as HTMLButtonElement).addEventListener(
    "click",
    () => {
      overlay.remove();
    },
  );
}

/* -------------------------
   Persistence helpers
   -------------------------*/
function persistCellStates() {
  try {
    // Convert Map to a serializable object
    const obj: Record<string, number | null> = {};
    cellStates.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(STORAGE_CELL_STATES, JSON.stringify(obj));
  } catch (e) {
    console.warn("Could not persist cell states:", e);
  }
}

function loadCellStates(): Map<string, number | null> {
  try {
    const raw = localStorage.getItem(STORAGE_CELL_STATES);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number | null>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function persistHeld() {
  try {
    localStorage.setItem(STORAGE_HAND, JSON.stringify(heldToken));
    // deno-lint-ignore no-empty
  } catch {}
}

function loadHeldToken(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_HAND);
    if (!raw) return null;
    return JSON.parse(raw) as number | null;
  } catch {
    return null;
  }
}

/* -------------------------
   Reset / New Game
   -------------------------*/
function resetWorld() {
  if (!confirm("Reset saved world state?")) return;
  cellStates.clear();
  persistCellStates();
  heldToken = null;
  persistHeld();
  updateInventoryUI();
  // re-render everything
  renderVisibleCells();
  flashMessage("World reset.");
}

function newGame() {
  if (
    !confirm(
      "Start a new game? This will clear all progress and reset your position.",
    )
  ) {
    return;
  }

  // Clear all game state
  cellStates.clear();
  persistCellStates();
  heldToken = null;
  persistHeld();
  playerLatLng = ORIGIN.clone();

  // Clear localStorage entirely
  localStorage.clear();

  // Update UI
  updateInventoryUI();
  updateStatusUI();

  // Re-render and center on origin
  renderVisibleCells();
  try {
    map.panTo(playerLatLng);
  } catch {
    // ignore
  }

  flashMessage("New game started!");
}

/* -------------------------
   Startup: render grid + attach map click for convenience
   -------------------------*/
// initial render already invoked above; ensure visibility once more
renderVisibleCells();
map.on("click", () => {
  // clicking empty map area clears messages
  (document.getElementById("msg") as HTMLDivElement).textContent = "";
});

// shift+click map to move player to clicked world position
map.on("click", (e: L.LeafletMouseEvent) => {
  const me = e as L.LeafletMouseEvent & { originalEvent?: MouseEvent };
  if (me.originalEvent && me.originalEvent.shiftKey) {
    playerLatLng = e.latlng.clone();
    renderVisibleCells();
    // center the map on the player so overlay remains meaningful
    try {
      map.panTo(playerLatLng);
    } catch {
      // ignore
    }
    updateStatusUI();
    flashMessage("Player moved.");
  }
});

/* -------------------------
   D3.d: Query String Mode Switching
   -------------------------*/
// Determine which movement controller to use based on query string
function getMovementMode(): "buttons" | "geolocation" {
  const params = new URLSearchParams(globalThis.location.search);
  const mode = params.get("movement");
  if (mode === "geolocation") {
    return "geolocation";
  }
  // Default to buttons if not specified or unrecognized
  return "buttons";
}

// Create the appropriate movement controller based on query string
const movementMode = getMovementMode();
const movementController: IMovementController = movementMode === "geolocation"
  ? new _GeolocationMovementController()
  : new ButtonMovementController();

// Update status UI to show which mode is active
function updateMovementModeUI() {
  const modeText = movementMode === "geolocation"
    ? "GPS/Geolocation"
    : "Keyboard";
  const statusEl = document.getElementById("statusPanel");
  if (statusEl) {
    const modeSpan = document.createElement("span");
    modeSpan.style.marginRight = "12px";
    modeSpan.innerHTML = `<strong>Mode:</strong> ${modeText}`;
    // Insert at beginning of status panel
    statusEl.insertAdjacentElement("afterbegin", modeSpan);
  }
}

// Register callback to move player when controller fires movement event
movementController.registerMoveCallback((lat: number, lng: number) => {
  playerLatLng = L.latLng(lat, lng);
  // Pan the map so the viewport recenters on the player's logical position
  try {
    map.panTo(playerLatLng);
  } catch {
    // ignore if panTo not available in some contexts
  }
  updateStatusUI();
});

// Activate the movement controller (starts listening for input)
movementController.activate();

// Show which mode is active
updateMovementModeUI();

/* -------------------------
   End of file
   -------------------------*/
