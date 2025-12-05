// @deno-types="npm:@types/leaflet"
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css"; // keep your stylesheet for layout (create if missing)

// keep these two starter files as-is in the project root / src
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

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
const RENDER_RADIUS_CELLS = 120; // draw many cells so map looks infinite
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
const STORAGE_OVERRIDES = "wob_overrides_v1"; // overrides: removed/placed/combined tokens
const STORAGE_HAND = "wob_hand_v1";

/* -------------------------
   In-memory state
   -------------------------*/
// overrides keyed by "i,j" where i,j are integer cell coords relative to classroom origin
const overrides: Record<string, number | null> = loadOverrides();
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
      <div id="msg" style="margin-left:8px;color:#222;"></div>
    </div>
  `;
  (document.getElementById("resetBtn") as HTMLButtonElement).addEventListener(
    "click",
    resetWorld,
  );
  updateInventoryUI();
}
makeControlUI();

// Status panel: show player coords & brief controls
function updateStatusUI() {
  statusPanelDiv.innerHTML = `Player: <strong>${playerLatLng.lat.toFixed(5)}, ${
    playerLatLng.lng.toFixed(5)
  }</strong> — Shift+click map to teleport.`;
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
  // If user override exists, respect it (override may be null for intentionally emptied)
  if (k in overrides) {
    return overrides[k] ?? null;
  }
  // else use luck to compute deterministic spawn
  const p = luck(`cell-${i}-${j}-spawn`);
  if (p < SPAWN_PROBABILITY) {
    // For D3.a tokens start at value 1
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
   Bulk render cells (so map looks infinite)
   -------------------------*/
// New render: only cells around player
function renderCellsAroundPlayer() {
  const { i: ci, j: cj } = _cellCoordsForLatLng(
    playerLatLng.lat,
    playerLatLng.lng,
  );

  // Track which keys we render so we can remove old items outside radius
  const keep = new Set<string>();

  for (let di = -RENDER_RADIUS_CELLS; di <= RENDER_RADIUS_CELLS; di++) {
    for (let dj = -RENDER_RADIUS_CELLS; dj <= RENDER_RADIUS_CELLS; dj++) {
      const i = ci + di;
      const j = cj + dj;
      const k = keyFor(i, j);
      keep.add(k);
      renderCell(i, j);
    }
  }

  // Remove rectangles/markers that are no longer within the render radius
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

// call it at startup
renderCellsAroundPlayer();

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

  const current = initialTokenForCell(i, j); // reads overrides first
  // Case A: pick up (have nothing in hand, cell has token)
  if (heldToken === null && current != null) {
    // pick it up
    heldToken = current;
    overrides[key] = null; // remove from cell (store override)
    persistOverrides();
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
    overrides[key] = heldToken;
    heldToken = null;
    persistOverrides();
    persistHeld();
    updateInventoryUI();
    renderCell(i, j);
    flashMessage(`Placed token in cell ${i},${j}.`);
    return;
  }

  // Case C: crafting (held token equal to cell token)
  if (heldToken != null && current === heldToken) {
    const newVal = heldToken * 2;
    overrides[key] = newVal;
    heldToken = null;
    persistOverrides();
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
function persistOverrides() {
  try {
    localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(overrides));
  } catch (e) {
    console.warn("Could not persist overrides:", e);
  }
}

function loadOverrides(): Record<string, number | null> {
  try {
    const raw = localStorage.getItem(STORAGE_OVERRIDES);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
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
   Reset / debug
   -------------------------*/
function resetWorld() {
  if (!confirm("Reset saved world state?")) return;
  for (const k in overrides) delete overrides[k];
  persistOverrides();
  heldToken = null;
  persistHeld();
  updateInventoryUI();
  // re-render everything
  renderCellsAroundPlayer();
  flashMessage("World reset.");
}

/* -------------------------
   Startup: render grid + attach map click for convenience
   -------------------------*/
renderCellsAroundPlayer();
map.on("click", () => {
  // clicking empty map area clears messages
  (document.getElementById("msg") as HTMLDivElement).textContent = "";
});

// shift+click map to move player to clicked world position
map.on("click", (e: L.LeafletMouseEvent) => {
  const me = e as L.LeafletMouseEvent & { originalEvent?: MouseEvent };
  if (me.originalEvent && me.originalEvent.shiftKey) {
    playerLatLng = e.latlng.clone();
    renderCellsAroundPlayer();
    updateStatusUI();
    flashMessage("Player moved.");
  }
});

// Movement helper (kept for future use): move by cell offsets (di,dj)
function _movePlayerByCells(di: number, dj: number) {
  playerLatLng = L.latLng(
    playerLatLng.lat + di * TILE_DEGREES,
    playerLatLng.lng + dj * TILE_DEGREES,
  );
  renderCellsAroundPlayer();
  updateStatusUI();
}

// Keyboard movement removed — use Shift+click or other UI to move player.

/* -------------------------
   End of file
   -------------------------*/
