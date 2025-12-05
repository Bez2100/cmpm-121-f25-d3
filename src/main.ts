// Import Leaflet and its CSS
// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for missing icons
import "./_leafletWorkaround.ts";

// Import deterministic RNG
import luck from "./_luck.ts";

// --- Basic DOM Setup ---

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
inventoryDiv.textContent = "Inventory: empty";
document.body.append(inventoryDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

console.log("luck test:", luck("startup"));

// --- Map Initialization ---

const CLASSROOM = leaflet.latLng(36.997936938057016, -122.05703507501151);

const map = leaflet.map(mapDiv, {
  center: CLASSROOM,
  zoom: 19,
  zoomControl: false,
  dragging: false, // Prevents moving the map
  scrollWheelZoom: false,
});

// Base tiles
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// Player marker
leaflet.marker(CLASSROOM).addTo(map);

const CELL_SIZE = 0.0001; // 0.0001 degrees ≈ size of a house
const GRID_RADIUS = 20; // draw 40×40 cells around player

// --- Grid System ---

function cellBounds(i: number, j: number) {
  const lat1 = CLASSROOM.lat + i * CELL_SIZE;
  const lng1 = CLASSROOM.lng + j * CELL_SIZE;
  const lat2 = CLASSROOM.lat + (i + 1) * CELL_SIZE;
  const lng2 = CLASSROOM.lng + (j + 1) * CELL_SIZE;
  return leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);
}

const cellLayers = new Map<string, leaflet.Rectangle>();

for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
  for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
    const key = `${i},${j}`;
    const rect = leaflet.rectangle(cellBounds(i, j), {
      color: "#999",
      weight: 1,
      fillOpacity: 0.05,
    });

    rect.addTo(map);
    cellLayers.set(key, rect);
  }
}
// --- Token Generation ---

interface CellState {
  value: number | null;
}

const world = new Map<string, CellState>();

function getCellState(i: number, j: number): CellState {
  const key = `${i},${j}`;
  if (world.has(key)) return world.get(key)!;

  const r = luck(`cell-${i}-${j}`);

  let value = null;
  if (r < 0.3) value = 1; // 30% chance, fixed forever

  const state = { value };
  world.set(key, state);
  return state;
}
function renderToken(i: number, j: number) {
  const key = `${i},${j}`;
  const rect = cellLayers.get(key)!;

  const state = getCellState(i, j);

  const value = state.value;
  const emoji = value ? (value === 1 ? "🍏" : "💎") : "";

  rect.bindTooltip(emoji ? `Token: ${value}` : "Empty", {
    permanent: true,
    className: "token-label",
    direction: "center",
  })
    .openTooltip();
}

// render for all cells
for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
  for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
    renderToken(i, j);
  }
}
