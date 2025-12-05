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

const WIN_TARGET = 16;

// ------------------------------
// STATE
// ------------------------------

type CellState = {
  tokenValue: number | null;
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

function cellKey(i: number, j: number) {
  return `${i},${j}`;
}

function getTokenValue(i: number, j: number) {
  const r = luck(`cell-${i}-${j}`);
  return r < 0.3 ? 1 : 0;
}

function cellBounds(i: number, j: number) {
  return leaflet.latLngBounds([
    [CLASSROOM.lat + i * CELL_SIZE, CLASSROOM.lng + j * CELL_SIZE],
    [CLASSROOM.lat + (i + 1) * CELL_SIZE, CLASSROOM.lng + (j + 1) * CELL_SIZE],
  ]);
}

function updateInventoryUI() {
  const inv = document.querySelector("#inventory")!;
  inv.textContent = inventory === null
    ? "Empty"
    : `Holding token: ${inventory}`;
}

function checkWin(value: number) {
  if (value >= WIN_TARGET) {
    alert(`You created a token of value ${value}! YOU WIN!`);
  }
}

// ------------------------------
// GRID CREATION
// ------------------------------

for (let i = -NEIGHBORHOOD; i <= NEIGHBORHOOD; i++) {
  for (let j = -NEIGHBORHOOD; j <= NEIGHBORHOOD; j++) {
    const key = cellKey(i, j);

    // Initialize state
    if (!cellStates.has(key)) {
      const base = getTokenValue(i, j);
      cellStates.set(key, {
        tokenValue: base === 0 ? null : base,
      });
    }

    const state = cellStates.get(key)!;

    const bounds = cellBounds(i, j);
    const rect = leaflet.rectangle(bounds, { color: "#888", weight: 1 });
    rect.addTo(map);

    // Label
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

    rect.on("click", () => {
      // 1) RANGE CHECK
      if (Math.abs(i) > INTERACT_RANGE || Math.abs(j) > INTERACT_RANGE) {
        alert("That cell is too far away.");
        return;
      }

      // ----------------------------
      // 2) PICKUP IF INVENTORY EMPTY
      // ----------------------------
      if (inventory === null) {
        if (state.tokenValue !== null) {
          inventory = state.tokenValue; // pick up
          state.tokenValue = null; // remove from cell
          refreshLabel();
          updateInventoryUI();
        }
        return;
      }

      // ----------------------------------------------------
      // 3) PLAYER HAS A TOKEN & CELL ALSO HAS A TOKEN
      //    → CRAFTING LOGIC (THIS IS THE STEP 7 UPDATE)
      // ----------------------------------------------------
      if (state.tokenValue !== null) {
        if (state.tokenValue !== inventory) {
          alert("Values do not match — cannot combine.");
          return;
        }

        const newValue = inventory * 2;
        state.tokenValue = newValue; // update cell
        inventory = null; // empty inventory

        refreshLabel();
        updateInventoryUI();
        checkWin(newValue); // check win

        return;
      }

      state.tokenValue = inventory; // place token
      inventory = null;
      refreshLabel();
      updateInventoryUI();
    });
  }
}

updateInventoryUI();
