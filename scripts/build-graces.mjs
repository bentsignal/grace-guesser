// Build src/data/graces.json from the raw MapGenie-derived site-of-grace dump.
//
// Source: data-src/site-of-grace.ts (richiexuetang/interactive-game-maps, MIT)
// Coordinates are MapGenie/Leaflet lat/lng in the game's flat-map space (the map
// renders with Leaflet's default CRS near origin, so lat/lng -> pixel is affine).
//
// We keep only the ABOVE-GROUND Lands Between:
//   - mapSlug === "the-lands-between"   (drops the Shadow of the Erdtree DLC)
//   - lat >= UNDERGROUND_LAT_MAX        (drops Siofra/Ainsel/Nokron/Deeproot/etc;
//                                         underground sits in a southern band with
//                                         a clean gap before the surface map)
//   - lng <= FARUM_LNG_MIN             (drops Crumbling Farum Azula, the sky dungeon)
//
// Region is assigned by nearest labeled anchor grace (k=1 KNN). Anchors are picked
// from real graces spread across each region, which respects region shape far better
// than single centroids at dense northern borders.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const UNDERGROUND_LAT_MAX = 0.5; // below this latitude => open-world underground
const FARUM_LNG_MIN = -0.55; // above (east of) this longitude => Crumbling Farum Azula

// Mislabeled / non-grace markers to drop outright (land in open ocean).
const EXCLUDE_NAMES = new Set(["Table of Lost Grace"]);

// Locked affine: (lng,lat) -> normalized image coords (0..1) over public/map/lod_0.jpeg.
// Fitted from hand-read landmark correspondences (see scripts/fit.mjs).
const TX = [2.364227, 0.160016, 1.970086]; // x = TX·[lng,lat,1]
const TY = [-0.217523, -2.329032, 2.007338]; // y = TY·[lng,lat,1]
const toXY = (lng, lat) => ({
  x: +(TX[0] * lng + TX[1] * lat + TX[2]).toFixed(5),
  y: +(TY[0] * lng + TY[1] * lat + TY[2]).toFixed(5),
});

// Region anchors: grace title -> region. Every other grace inherits the region of
// its nearest anchor. Keep anchors unambiguous and well spread within each region.
const ANCHORS = {
  "Weeping Peninsula": [
    "Castle Morne Rampart", "Behind the Castle", "Tombsward", "Tombsward Cave",
    "Church of Pilgrimage", "Bridge of Sacrifice", "Ailing Village Outskirts",
    "Fourth Church of Marika", "Beside the Crater-Pocked Glade", "Morne Moangrave",
  ],
  "Limgrave": [
    "Gatefront", "The First Step", "Church of Elleh", "Agheel Lake North",
    "Agheel Lake South", "Stormveil Cliffside", "Margit, the Fell Omen",
    "Mistwood Outskirts", "Limgrave Tunnels", "Murkwater Cave", "Fort Haight West",
    "Divine Tower of Limgrave", "Stormfoot Catacombs", "Seaside Ruins", "Artist's Shack",
  ],
  "Caelid": [
    "Redmane Castle Plaza", "Aeonia Swamp Shore", "Caelid Highway South", "Fort Faroth",
    "Sellia Crystal Tunnel", "Dragonbarrow West", "Bestial Sanctum", "Smoldering Church",
    "Caelid Catacombs", "Starscourge Radahn", "Divine Tower of Caelid: Center",
    "Caelem Ruins", "Impassable Greatbridge", "Southern Aeonia Swamp Bank",
  ],
  "Liurnia of the Lakes": [
    "Liurnia Lake Shore", "Academy Gate Town", "Raya Lucaria Grand Library",
    "Church of Vows", "Ranni's Rise", "Village of the Albinaurics", "Moonlight Altar",
    "Boilprawn Shack", "Ruin-Strewn Precipice", "Bellum Church", "Eastern Tableland",
    "Jarburg", "Main Caria Manor Gate", "Northern Liurnia Lake Shore", "Folly on the Lake",
    "The Four Belfries", "Divine Tower of Liurnia", "Church of the Cuckoo",
  ],
  "Altus Plateau": [
    "Altus Plateau", "Altus Highway Junction", "Bower of Bounty", "Sainted Hero's Grave",
    "Wyndham Catacombs", "Shaded Castle Ramparts", "Windmill Village", "Rampartside Path",
    "Sage's Cave", "Erdtree-Gazing Hill", "Grand Lift of Dectus", "Abandoned Coffin",
    "Divine Tower of West Altus", "Forest-Spanning Greatbridge", "Windmill Heights",
  ],
  "Mt. Gelmir": [
    "Volcano Manor", "Rykard, Lord of Blasphemy", "Seethewater River",
    "First Mt. Gelmir Campsite", "Temple of Eiglay", "Craftsman's Shack",
    "Gelmir Hero's Grave", "Road of Iniquity", "Seethewater Terminus", "Volcano Cave",
    "Ninth Mt. Gelmir Campsite", "Prison Town Church", "Bridge of Iniquity",
  ],
  "Leyndell, Royal Capital": [
    "Avenue Balcony", "Elden Throne", "Capital Rampart", "Auriza Hero's Grave",
    "Erdtree Sanctuary", "Queen's Bedchamber", "Lower Capital Church", "East Capital Rampart",
    "West Capital Rampart", "Divine Bridge", "Fortified Manor, First Floor",
    "Leyndell, Capital of Ash", "Auriza Side Tomb", "Sealed Tunnel",
  ],
  "Mountaintops of the Giants": [
    "Forge of The Giants", "Fire Giant", "Zamor Ruins", "Grand Lift of Rold",
    "Church of Repose", "Giant-Conquering Hero's Grave", "Giants' Mountaintop Catacombs",
    "Foot of the Forge", "Giant's Gravepost", "Forbidden Lands",
  ],
  "Consecrated Snowfield": [
    "Consecrated Snowfield", "Inner Consecrated Snowfield", "Ordina, Liturgical Town",
    "Castle Sol Main Gate", "Yelough Anix Tunnel", "First Church of Marika", "Freezing Lake",
    "Apostate Derelict", "Cave of the Forlorn", "Spiritcaller's Cave", "Church of the Eclipse",
    "Snow Valley Ruins Overlook", "Hidden Path to the Haligtree", "Whiteridge Road",
    "Ancient Snow Valley Ruins", "Consecrated Snowfield Catacombs",
  ],
  "Miquella's Haligtree": [
    "Haligtree Town", "Haligtree Town Plaza", "Malenia, Goddess of Rot",
    "Elphael Inner Wall", "Prayer Room", "Haligtree Canopy", "Haligtree Promenade",
    "Drainage Channel", "Haligtree Roots",
  ],
};

function parseGraces(src) {
  const blocks = src.split(/\n {2}\{\n/).slice(1);
  const out = [];
  for (const b of blocks) {
    const slug = (b.match(/mapSlug:\s*"([^"]+)"/) || [])[1];
    if (slug !== "the-lands-between") continue;
    const id = Number((b.match(/id:\s*(\d+)/) || [])[1]);
    const title = (b.match(/title:\s*"([^"]+)"/) || [])[1];
    const lat = Number((b.match(/latitude:\s*"([-0-9.]+)"/) || [])[1]);
    const lng = Number((b.match(/longitude:\s*"([-0-9.]+)"/) || [])[1]);
    if (title && Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ id, title, lat, lng });
    }
  }
  return out;
}

function buildAnchorPoints(graceByTitle) {
  const pts = [];
  for (const [region, titles] of Object.entries(ANCHORS)) {
    for (const t of titles) {
      const g = graceByTitle.get(t);
      if (!g) {
        console.warn(`  ! anchor not found in data: "${t}" (${region})`);
        continue;
      }
      pts.push({ region, lat: g.lat, lng: g.lng });
    }
  }
  return pts;
}

function nearestRegion(lat, lng, anchors) {
  let best = null;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a.region;
    }
  }
  return best;
}

const srcPath = path.join(root, "data-src", "site-of-grace.ts");
const src = fs.readFileSync(srcPath, "utf8");

const all = parseGraces(src);
const byTitle = new Map(all.map((g) => [g.title, g]));
const anchors = buildAnchorPoints(byTitle);

const kept = [];
const dropped = { underground: 0, farum: 0, excluded: 0 };
for (const g of all) {
  if (EXCLUDE_NAMES.has(g.title)) {
    dropped.excluded++;
    continue;
  }
  if (g.lat < UNDERGROUND_LAT_MAX) {
    dropped.underground++;
    continue;
  }
  if (g.lng > FARUM_LNG_MIN) {
    dropped.farum++;
    continue;
  }
  const { x, y } = toXY(g.lng, g.lat);
  kept.push({
    id: g.id,
    name: g.title,
    region: nearestRegion(g.lat, g.lng, anchors),
    x, // normalized 0..1 across map width (left->right)
    y, // normalized 0..1 down map height (top->bottom)
  });
}

kept.sort((a, b) => a.name.localeCompare(b.name));

const outDir = path.join(root, "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "graces.json"), JSON.stringify(kept, null, 2) + "\n");

// Report
console.log(`parsed ${all.length} the-lands-between graces`);
console.log(`dropped: ${dropped.underground} underground, ${dropped.farum} farum azula, ${dropped.excluded} excluded`);
console.log(`kept ${kept.length} above-ground graces\n`);
const counts = {};
for (const g of kept) counts[g.region] = (counts[g.region] || 0) + 1;
for (const r of Object.keys(ANCHORS)) console.log(`  ${String(counts[r] || 0).padStart(3)}  ${r}`);
const unknown = kept.filter((g) => !g.region);
if (unknown.length) console.log(`\n  !! ${unknown.length} unassigned:`, unknown.map((g) => g.name));
