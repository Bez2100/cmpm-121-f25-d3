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
