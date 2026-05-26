#!/usr/bin/env node
/**
 * Parses an OSM XML file (from osmium cat) and uploads hiking trail data
 * to Firestore keyed by 0.1° grid cells.
 *
 * Workflow:
 *   osmium tags-filter region.osm.pbf r/route=hiking r/route=foot -o hiking.osm.pbf
 *   osmium cat hiking.osm.pbf -o hiking.osm --output-format=osm
 *   node scripts/uploadOsmXml.js --file hiking.osm [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const { XMLParser } = require(path.join(__dirname, "../functions/node_modules/fast-xml-parser"));
const { haversineKm } = require("./lib/overpassFetch");

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return fallback;
}
const isDryRun = args.includes("--dry-run");
const filePath = arg("file");

if (!filePath) {
  console.error("Usage: node uploadOsmXml.js --file <hiking.osm> [--dry-run]");
  console.error("\nPipeline:");
  console.error("  osmium tags-filter region.osm.pbf r/route=hiking r/route=foot -o hiking.osm.pbf");
  console.error("  osmium cat hiking.osm.pbf -o hiking.osm --output-format=osm");
  console.error("  node scripts/uploadOsmXml.js --file hiking.osm");
  process.exit(1);
}

function cellId(lat, lng) {
  const gridLat = Math.round(lat * 10) / 10;
  const gridLng = Math.round(lng * 10) / 10;
  return `${gridLat.toFixed(1)}_${gridLng.toFixed(1)}`;
}

const JUNK_NAMES = new Set(["connector trail", "connector", "path", "track"]);
const NON_HIKING_ROUTES = new Set(["road", "bicycle", "mtb", "horse", "bus", "train", "tram", "ferry"]);

async function main() {
  console.log(`\nParsing ${filePath} ...`);

  const xml = fs.readFileSync(filePath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xml);
  const osm = doc.osm;

  // Build node map: id → {lat, lng}
  const nodeMap = new Map();
  const nodes = Array.isArray(osm.node) ? osm.node : osm.node ? [osm.node] : [];
  for (const n of nodes) {
    nodeMap.set(String(n.id), { lat: parseFloat(n.lat), lng: parseFloat(n.lon) });
  }
  console.log(`  Nodes: ${nodeMap.size}`);

  // Build way map: id → [[lng, lat], ...]
  const wayMap = new Map();
  const ways = Array.isArray(osm.way) ? osm.way : osm.way ? [osm.way] : [];
  for (const w of ways) {
    const nds = Array.isArray(w.nd) ? w.nd : w.nd ? [w.nd] : [];
    const coords = [];
    for (const nd of nds) {
      const node = nodeMap.get(String(nd.ref));
      if (node) coords.push([node.lng, node.lat]);
    }
    if (coords.length >= 2) wayMap.set(String(w.id), coords);
  }
  console.log(`  Ways: ${wayMap.size}`);

  // Parse route relations
  const relations = Array.isArray(osm.relation) ? osm.relation : osm.relation ? [osm.relation] : [];
  console.log(`  Relations: ${relations.length}\n`);

  const trails = [];

  for (const rel of relations) {
    // Extract tags
    const tagArr = Array.isArray(rel.tag) ? rel.tag : rel.tag ? [rel.tag] : [];
    const tags = {};
    for (const t of tagArr) tags[t.k] = t.v;

    if (!tags.name) continue;
    const name = tags.name.trim();
    if (JUNK_NAMES.has(name.toLowerCase())) continue;

    const route = tags.route;
    if (!route || NON_HIKING_ROUTES.has(route)) continue;

    // Collect geometry from member ways
    const members = Array.isArray(rel.member) ? rel.member : rel.member ? [rel.member] : [];
    let totalKm = 0;
    const allCoords = [];

    for (const m of members) {
      if (m.type !== "way") continue;
      const coords = wayMap.get(String(m.ref));
      if (!coords || coords.length < 2) continue;
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        totalKm += haversineKm(a[1], a[0], b[1], b[0]);
        allCoords.push(a);
      }
      allCoords.push(coords[coords.length - 1]);
    }

    if (totalKm < 0.4 || allCoords.length < 2) continue;

    const distanceMiles = Math.round(totalKm * 0.621371 * 10) / 10;
    const estimatedDurationHours = Math.round((distanceMiles / 2) * 10) / 10;

    let difficulty, category;
    if (distanceMiles < 2)       { difficulty = "easy";     category = "walk"; }
    else if (distanceMiles <= 6) { difficulty = "moderate"; category = "moderate_hike"; }
    else                         { difficulty = "hard";     category = "major_hike"; }

    const ascentM = tags.ascent ? parseFloat(tags.ascent) : null;
    const elevationGainFt = ascentM ? Math.round(ascentM * 3.28084) : null;

    const midIdx = Math.floor(allCoords.length / 2);
    const centerLat = allCoords[midIdx][1];
    const centerLng = allCoords[midIdx][0];
    const cell = cellId(centerLat, centerLng);

    trails.push({
      id: String(rel.id),
      destinationId: cell,
      name,
      distanceMiles,
      estimatedDurationHours,
      elevationGainFt,
      difficulty,
      category,
      tags: Object.entries(tags)
        .filter(([k]) => ["surface", "sac_scale", "trail_visibility", "access"].includes(k))
        .map(([k, v]) => `${k}:${v}`),
      coordinates: {
        start: { lat: allCoords[0][1], lng: allCoords[0][0] },
        end:   { lat: allCoords[allCoords.length - 1][1], lng: allCoords[allCoords.length - 1][0] },
      },
      centerLat,
      centerLng,
      source: "osm",
      osmId: parseInt(rel.id),
    });
  }

  console.log(`Parsed ${trails.length} hiking trails\n`);

  if (trails.length === 0) {
    console.log("No trails found.");
    process.exit(0);
  }

  // Group by 0.1° grid cell, deduplicate by name within each cell, cap at 50
  const cells = new Map();
  for (const trail of trails) {
    const key = trail.destinationId;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(trail);
  }
  for (const [key, arr] of cells) {
    const seen = new Set();
    cells.set(
      key,
      arr
        .filter(t => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => b.distanceMiles - a.distanceMiles)
        .slice(0, 50)
    );
  }

  // Report
  console.log(`${cells.size} grid cells:\n`);
  for (const [key, arr] of [...cells.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
    console.log(`  ${key}  (${arr.length} trails)`);
    for (const t of arr.slice(0, 3)) {
      const elev = t.elevationGainFt ? ` +${t.elevationGainFt}ft` : "";
      console.log(`    • ${t.name}: ${t.distanceMiles}mi  ${t.difficulty}${elev}`);
    }
  }
  if (cells.size > 20) console.log(`  … and ${cells.size - 20} more cells`);

  if (isDryRun) {
    console.log("\n[dry-run] Skipping Firestore write.");
    return;
  }

  // Firestore write
  let admin;
  try {
    admin = require(path.join(__dirname, "../functions/node_modules/firebase-admin"));
  } catch {
    console.error("\nCould not load firebase-admin. Run `npm install` inside functions/ first.");
    process.exit(1);
  }

  let projectId;
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(__dirname, "../.firebaserc"), "utf8"));
    projectId = rc.projects?.default;
  } catch {
    console.error("\nCould not read .firebaserc.");
    process.exit(1);
  }

  const serviceAccountPath = arg("service-account") ||
    (fs.existsSync(path.join(__dirname, "serviceAccount.json"))
      ? path.join(__dirname, "serviceAccount.json")
      : null);

  const appConfig = serviceAccountPath
    ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))), projectId }
    : { projectId };

  admin.initializeApp(appConfig);
  const db = admin.firestore();

  console.log(`\nWriting ${cells.size} cells to Firestore (${projectId})...\n`);

  const entries = [...cells.entries()];
  let written = 0;
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    for (const [key, cellTrails] of entries.slice(i, i + 400)) {
      batch.set(db.collection("trails").doc(key), {
        cellId: key,
        trails: cellTrails,
        ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
        trailCount: cellTrails.length,
        source: "osm-pbf",
      });
    }
    await batch.commit();
    written += Math.min(400, entries.length - i);
    console.log(`  ${written}/${cells.size} cells written...`);
  }

  console.log(`\n✓ Done. ${cells.size} grid cells written to Firestore.`);
}

main().catch(err => { console.error("\nFatal:", err); process.exit(1); });
