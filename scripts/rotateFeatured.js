#!/usr/bin/env node
/**
 * Featured Trip rotation runner.
 *
 * Advances featuredTrips/current one step through the rotation pool (the same
 * logic the rotateFeaturedTripWeekly cloud function runs every Monday). Use this
 * to seed the very first featured trip, or to manually skip to the next one.
 *
 * Reuses functions/lib/featuredRotation.js — run `npm --prefix functions run build`
 * first so the compiled module exists.
 *
 * Usage:
 *   node scripts/rotateFeatured.js            # advance to the next trip
 *   node scripts/rotateFeatured.js --refresh  # re-publish the current trip (no advance)
 *
 * Auth (in priority order):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (base64-encoded service account JSON)
 *   2. scripts/serviceAccount.json file (local dev)
 *   3. Application Default Credentials + .firebaserc project ID
 */

const path = require("path");
const fs = require("fs");

function initAdmin() {
  let admin;
  try {
    admin = require(path.join(__dirname, "../functions/node_modules/firebase-admin"));
  } catch {
    console.error("Could not load firebase-admin. Run `npm install` inside functions/ first.");
    process.exit(1);
  }

  let appConfig;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8");
    const sa = JSON.parse(raw);
    appConfig = { credential: admin.credential.cert(sa), projectId: sa.project_id };
    console.log(`Auth: service account from env (project: ${sa.project_id})`);
  } else if (fs.existsSync(path.join(__dirname, "serviceAccount.json"))) {
    const sa = JSON.parse(fs.readFileSync(path.join(__dirname, "serviceAccount.json"), "utf8"));
    appConfig = { credential: admin.credential.cert(sa), projectId: sa.project_id };
    console.log(`Auth: scripts/serviceAccount.json (project: ${sa.project_id})`);
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
  return admin.firestore();
}

async function main() {
  const advance = !process.argv.includes("--refresh");

  let rotateFeatured;
  try {
    ({ rotateFeatured } = require(path.join(__dirname, "../functions/lib/featuredRotation.js")));
  } catch (e) {
    console.error("Could not load functions/lib/featuredRotation.js.");
    console.error("Build the functions first:  npm --prefix functions run build");
    console.error(e.message);
    process.exit(1);
  }

  const db = initAdmin();
  const result = await rotateFeatured(db, { advance });
  console.log(
    `✓ Featured trip ${advance ? "advanced" : "refreshed"} → ${result.tripId} ` +
      `(index ${result.rotationIndex})`
  );
  console.log(`  heroImage: ${result.heroImage || "(none)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Rotation failed:", err);
  process.exit(1);
});
