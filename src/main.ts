// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts";

// ------------------------------
// DOM LAYOUT
// ------------------------------

const controlPanel = document.createElement("div");
controlPanel.id = "controlPanel";
controlPanel.innerHTML = `
<h2>Inventory</h2>
<div id="inventory">Empty</div>`;
document.body.append(controlPanel);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// ------------------------------
// CONSTANTS
// ------------------------------

const CLASSROOM = leaflet.latLng(36.997936938057016, -122.05703507501151);

const CELL_SIZE = 0.0001;
const NEIGHBORHOOD = 8;
const INTERACT_RANGE = 3;

// ------------------------------
// STATE
// ------------------------------

type CellState = {
  tokenValue: number | null; // null = empty
};

const cellStates = new Map<string, CellState>();

let inventory: number | null = null;

// ------------------------------
// MAP INITIALIZATION
// ------------------------------

const map = leaflet.map(mapDiv, {
  center: CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  })
  .addTo(map);

leaflet.marker(CLASSROOM).addTo(map).bindTooltip("You are here!");

// ------------------------------
// HELPERS
// ------------------------------

// key for Map<string,CellState>
function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

// deterministic token value
function getTokenValue(i: number, j: number) {
  const r = luck(`cell-${i}-${j}`);
  return r < 0.3 ? 1 : 0; // 30% chance of token = 1
}

// convert cell coords to Leaflet bounds
function cellBounds(i: number, j: number) {
  return leaflet.latLngBounds([
    [CLASSROOM.lat + i * CELL_SIZE, CLASSROOM.lng + j * CELL_SIZE],
    [CLASSROOM.lat + (i + 1) * CELL_SIZE, CLASSROOM.lng + (j + 1) * CELL_SIZE],
  ]);
}

// update UI
function updateInventoryUI() {
  const inv = document.querySelector("#inventory")!;
  inv.textContent = inventory === null
    ? "Empty"
    : `Holding token: ${inventory}`;
}

// ------------------------------
// GRID CREATION
// ------------------------------

for (let i = -NEIGHBORHOOD; i <= NEIGHBORHOOD; i++) {
  for (let j = -NEIGHBORHOOD; j <= NEIGHBORHOOD; j++) {
    const key = cellKey(i, j);

    // Initialize deterministic state
    if (!cellStates.has(key)) {
      const baseValue = getTokenValue(i, j);
      cellStates.set(key, {
        tokenValue: baseValue === 0 ? null : baseValue,
      });
    }

    const state = cellStates.get(key)!;
    const bounds = cellBounds(i, j);
    const rect = leaflet.rectangle(bounds, { color: "#888", weight: 1 });
    rect.addTo(map);

    // Label showing current token
    const label = leaflet.marker(bounds.getCenter(), {
      interactive: false,
      opacity: 0,
    });
    label.bindTooltip("", {
      permanent: true,
      direction: "center",
      className: "tokenLabel",
    });

    // deno-lint-ignore no-inner-declarations
    function refreshLabel() {
      label.setTooltipContent(
        state.tokenValue === null ? "" : `${state.tokenValue}`,
      );
    }
    refreshLabel();
    label.addTo(map);

    // ------------------------------
    // CLICK INTERACTION
    // ------------------------------
    rect.on("click", () => {
      // Check range
      if (Math.abs(i) > INTERACT_RANGE || Math.abs(j) > INTERACT_RANGE) {
        alert("That cell is too far away.");
        return;
      }

      // PICKUP LOGIC
      if (inventory === null) {
        if (state.tokenValue !== null) {
          inventory = state.tokenValue; // pick it up
          state.tokenValue = null;
          refreshLabel();
          updateInventoryUI();
        }
        return;
      }

      // If inventory is not null but cell has no crafting yet (Step 7)
      // Just notify for now:
      if (state.tokenValue === null) {
        alert("Cell is empty. (Crafting implemented in Step 7)");
      } else {
        alert("Cell contains a token. Crafting comes in Step 7.");
      }
    });
  }
}

updateInventoryUI();
