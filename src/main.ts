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

console.log("Leaflet loaded:", leaflet);
