import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { type OsmHike } from "./types";

interface TrailCacheDoc {
  cellId: string;
  trails: OsmHike[];
  ingestedAt: admin.firestore.Timestamp;
  trailCount: number;
}

function gridCellId(lat: number, lng: number): string {
  const gridLat = Math.round(lat * 10) / 10;
  const gridLng = Math.round(lng * 10) / 10;
  return `${gridLat.toFixed(1)}_${gridLng.toFixed(1)}`;
}

/**
 * Reads pre-ingested hiking trail data from Firestore.
 * Trails are keyed by 0.1° grid cell (~11km × 9km).
 * Data is written by scripts/uploadTrailData.js (run outside Firebase).
 * On cache miss, enqueues the cell for background ingestion via GitHub Actions.
 */
export async function fetchHikingTrails(
  centerLat: number,
  centerLng: number
): Promise<OsmHike[]> {
  const cellId = gridCellId(centerLat, centerLng);
  const db = admin.firestore();

  try {
    const doc = await db.collection("trails").doc(cellId).get();
    if (doc.exists) {
      const data = doc.data() as TrailCacheDoc;
      const trails = data.trails ?? [];
      logger.info("Trail cache hit", { cellId, count: trails.length });
      return trails;
    }

    logger.info("No trail data for cell — queuing ingestion", { cellId, centerLat, centerLng });
    await db
      .collection("trailIngestionQueue")
      .doc(cellId)
      .set(
        {
          cellId,
          centerLat,
          centerLng,
          status: "pending",
          queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch((e) => logger.warn("Failed to enqueue trail ingestion", { err: String(e) }));

    return [];
  } catch (err) {
    logger.warn("Trail cache read failed", { cellId, err: String(err) });
    return [];
  }
}
