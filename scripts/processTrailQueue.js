#!/usr/bin/env node
/**
 * Trail Queue Processor
 *
 * Reads pending requests from Firestore `trailIngestionQueue`, fetches hiking
 * trail data from Overpass, and writes results to `trails/{destinationId}`.
 *
 * Designed to run as a GitHub Actions scheduled job — GitHub's runners are NOT
 * GCP IPs, so Overpass endpoints work without rate-limiting.
 *
 * Auth (in priority order):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (GitHub Actions secret — base64-encoded JSON)
 *   2. scripts/serviceAccount.json file (local dev)
 *   3. Application Default Credentials (gcloud CLI logged in)
 */

const path = require("path");
const fs = require("fs");
const { OVERPASS_URLS, httpsPost, parseTrails } = require("./lib/overpassFetch");

const MAX_BATCH = parseInt(process.env.MAX_BATCH ?? "10", 10);

// ─── Firestore init ───────────────────────────────────────────────────────────

function initAdmin() {
  let admin;
  try {
    admin = require(path.join(__dirname, "../functions/node_modules/firebase-admin"));
  } catch {
    console.error("Could not load firebase-admin. Run `npm install` inside functions/ first.");
    process.exit(1);
  }

  let appConfig;

  // Option 1: GitHub Actions secret (base64-encoded service account JSON)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8");
    const sa = JSON.parse(raw);
    appConfig = { credential: admin.credential.cert(sa), projectId: sa.project_id };
    console.log(`Auth: service account from env (project: ${sa.project_id})`);

  // Option 2: Local service account file
  } else if (fs.existsSync(path.join(__dirname, "serviceAccount.json"))) {
    const sa = JSON.parse(fs.readFileSync(path.join(__dirname, "serviceAccount.json"), "utf8"));
    appConfig = { credential: admin.credential.cert(sa), projectId: sa.project_id };
    console.log(`Auth: scripts/serviceAccount.json (project: ${sa.project_id})`);

  // Option 3: ADC + .firebaserc project ID
  } else {
    let projectId;
    try {
      const rc = JSON.parse(fs.readFileSync(path.join(__dirname, "../.firebaserc"), "utf8"));
      projectId = rc.projects?.default;
    } catch {
      console.error("Could not read .firebaserc and no service account found.");
      process.exit(1);
    }
    appConfig = { projectId };
    console.log(`Auth: Application Default Credentials (project: ${projectId})`);
  }

  admin.initializeApp(appConfig);
  return { admin, db: admin.firestore() };
}

// ─── Overpass fetch ───────────────────────────────────────────────────────────

async function fetchTrailsFromOverpass(destinationId, lat, lng, radiusMeters) {
  const query = `[out:json][timeout:45];
(
  relation["route"="hiking"]["name"](around:${radiusMeters},${lat},${lng});
  relation["route"="foot"]["name"](around:${radiusMeters},${lat},${lng});
);
out center geom;`;

  const body = `data=${encodeURIComponent(query)}`;

  for (const url of OVERPASS_URLS) {
    try {
      console.log(`    Trying ${url} ...`);
      const res = await httpsPost(url, body);
      if (res.status === 200) {
        const rawJson = JSON.parse(res.body);
        console.log(`    ✓ Got ${res.body.length} bytes`);
        return parseTrails(rawJson.elements ?? [], destinationId, lat, lng);
      }
      console.log(`    ✗ HTTP ${res.status}: ${res.body.slice(0, 80)}`);
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
    }
  }

  throw new Error("All Overpass endpoints failed");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Trail Queue Processor ===\n");

  const { admin, db } = initAdmin();

  const snapshot = await db
    .collection("trailIngestionQueue")
    .where("status", "==", "pending")
    .limit(MAX_BATCH)
    .get();

  if (snapshot.empty) {
    console.log("\nNo pending trail ingestion requests. Done.");
    return;
  }

  console.log(`\nFound ${snapshot.size} pending request(s).\n`);

  let succeeded = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const { destinationId, centerLat, centerLng, radiusMeters = 15000 } = doc.data();
    console.log(`--- ${destinationId} (${centerLat}, ${centerLng}, r=${radiusMeters}m) ---`);

    await doc.ref.update({
      status: "processing",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const trails = await fetchTrailsFromOverpass(destinationId, centerLat, centerLng, radiusMeters);

      await db.collection("trails").doc(destinationId).set({
        destinationId,
        trails,
        ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
        centerLat,
        centerLng,
        radiusMeters,
        trailCount: trails.length,
      });

      await doc.ref.update({
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        trailCount: trails.length,
      });

      for (const t of trails) {
        const elev = t.elevationGainFt ? ` +${t.elevationGainFt}ft` : "";
        console.log(`    ${t.name}: ${t.distanceMiles}mi  ~${t.estimatedDurationHours}h  ${t.difficulty}${elev}`);
      }
      console.log(`  ✓ Written ${trails.length} trails to trails/${destinationId}\n`);
      succeeded++;

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      await doc.ref.update({
        status: "failed",
        error: String(err.message),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      failed++;
    }
  }

  console.log(`\nDone — ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
