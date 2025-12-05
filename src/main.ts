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
