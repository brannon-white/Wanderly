#!/usr/bin/env node
/**
 * Wanderly Trail Ingestion Script
 *
 * Fetches hiking trail data from OpenStreetMap (Overpass API) and writes it
 * to Firestore so Firebase functions never need to call Overpass directly.
 *
 * Run from your Mac (or any machine where Overpass is reachable):
 *
 *   node scripts/ingestTrails.js --destination zion-us --lat 37.2982 --lng -112.9628
 *   node scripts/ingestTrails.js --destination yosemite-us --lat 37.8651 --lng -119.5383
 *   node scripts/ingestTrails.js --destination banff-ca --lat 51.1784 --lng -115.5708
 *
 * Optional flags:
 *   --radius   Search radius in meters (default: 15000)
 *   --dry-run  Print results without writing to Firestore
 *
 * Auth: uses your Firebase CLI credentials (run `firebase login` first).
 * Project: read from .firebaserc in the repo root.
 */

const fs = require("fs");
const path = require("path");
const { OVERPASS_URLS, httpsPost, parseTrails } = require("./lib/overpassFetch");

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return fallback;
}
const isDryRun = args.includes("--dry-run");

const destinationId = arg("destination");
const lat = parseFloat(arg("lat"));
const lng = parseFloat(arg("lng"));
const radiusMeters = parseInt(arg("radius", "15000"), 10);

if (!destinationId || isNaN(lat) || isNaN(lng)) {
  console.error("Usage: node ingestTrails.js --destination <id> --lat <lat> --lng <lng> [--radius <m>] [--dry-run]");
  console.error("Example: node ingestTrails.js --destination zion-us --lat 37.2982 --lng -112.9628");
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nIngesting trails for: ${destinationId}`);
  console.log(`  Center: ${lat}, ${lng}  Radius: ${radiusMeters}m\n`);

  const query = `[out:json][timeout:45];
(
  relation["route"="hiking"]["name"](around:${radiusMeters},${lat},${lng});
  relation["route"="foot"]["name"](around:${radiusMeters},${lat},${lng});
);
out center geom;`;

  const body = `data=${encodeURIComponent(query)}`;

  let rawJson = null;
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Trying ${url} ...`);
      const res = await httpsPost(url, body);
      if (res.status === 200) {
        rawJson = JSON.parse(res.body);
        console.log(`  ✓ Got response (${res.body.length} bytes)`);
        break;
      }
      console.log(`  ✗ HTTP ${res.status}: ${res.body.slice(0, 100)}`);
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
    }
  }

  if (!rawJson) {
    console.error("\nAll Overpass endpoints failed. Check your network connection.");
    process.exit(1);
  }

  const trails = parseTrails(rawJson.elements ?? [], destinationId, lat, lng);
  console.log(`\nParsed ${trails.length} trails:\n`);
  for (const t of trails) {
    const elev = t.elevationGainFt ? ` +${t.elevationGainFt}ft` : "";
    console.log(`  ${t.name}: ${t.distanceMiles}mi  ~${t.estimatedDurationHours}h  ${t.difficulty}${elev}`);
  }

  if (isDryRun) {
    console.log("\n[dry-run] Skipping Firestore write.");
    return;
  }

  // ─── Write to Firestore ─────────────────────────────────────────────────────

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
    console.error("\nCould not read .firebaserc. Run this from the repo root.");
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

  console.log(`\nWriting to Firestore project: ${projectId}`);

  const docRef = db.collection("trails").doc(destinationId);
  await docRef.set({
    destinationId,
    trails,
    ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
    centerLat: lat,
    centerLng: lng,
    radiusMeters,
    trailCount: trails.length,
  });

  console.log(`\n✓ Written ${trails.length} trails to trails/${destinationId}`);
  console.log("  Firebase functions will now use this cached data.");
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
