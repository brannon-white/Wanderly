import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { type OsmHike } from "./types";

interface TrailCacheDoc {
  cellId: string;
  trails: OsmHike[];
  ingestedAt?: admin.firestore.Timestamp;
  trailCount: number;
  source?: string;
}

function gridCellId(lat: number, lng: number): string {
  const gridLat = Math.round(lat * 10) / 10;
  const gridLng = Math.round(lng * 10) / 10;
  return `${gridLat.toFixed(1)}_${gridLng.toFixed(1)}`;
}

// Waymark GIS API — a curated trails dataset (OSM + NPS + Geofabrik, deduped) and the
// source of truth for hiking trails. Its /wanderly endpoint returns objects already
// shaped like our OsmHike. Base URL is overridable via env so it can be self-hosted.
const WAYMARK_BASE = (process.env.WAYMARK_API_URL || "https://waymark-api.onrender.com").replace(/\/+$/, "");
const WAYMARK_TIMEOUT_MS = 10_000; // Render free tier can cold-start; fail soft past this.
// Firestore is a fast cache in front of Waymark; refresh a cell once it's older than this.
const TRAIL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const DIFFICULTIES = new Set(["easy", "moderate", "hard"]);
const CATEGORIES = new Set(["walk", "moderate_hike", "major_hike"]);

// Coerce a Waymark trail into a valid OsmHike, dropping anything malformed.
function toOsmHike(t: Record<string, unknown>): OsmHike | null {
  const id = typeof t.id === "string" ? t.id : null;
  const name = typeof t.name === "string" ? t.name : null;
  const lat = Number(t.centerLat);
  const lng = Number(t.centerLng);
  if (!id || !name || !isFinite(lat) || !isFinite(lng)) return null;
  const difficulty = DIFFICULTIES.has(String(t.difficulty)) ? (t.difficulty as OsmHike["difficulty"]) : "moderate";
  const category = CATEGORIES.has(String(t.category)) ? (t.category as OsmHike["category"]) : "moderate_hike";
  return {
    id,
    name,
    distanceMiles: isFinite(Number(t.distanceMiles)) ? Number(t.distanceMiles) : 0,
    estimatedDurationHours: isFinite(Number(t.estimatedDurationHours)) ? Number(t.estimatedDurationHours) : 0,
    difficulty,
    category,
    centerLat: lat,
    centerLng: lng,
  };
}

// Live trail fetch from the Waymark GIS. Returns [] on any failure/timeout so the
// caller can fall back to cached data (or nothing).
async function fetchWaymarkTrails(lat: number, lng: number, radiusKm = 30, limit = 60): Promise<OsmHike[]> {
  const url = `${WAYMARK_BASE}/api/wanderly/trails/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAYMARK_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      logger.warn("Waymark non-OK", { status: res.status });
      return [];
    }
    const data = await res.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return [];
    return data.map(toOsmHike).filter((t): t is OsmHike => t !== null);
  } catch (err) {
    logger.warn("Waymark fetch failed", { err: String(err) });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function cacheTrails(cellId: string, trails: OsmHike[]): Promise<void> {
  await admin.firestore().collection("trails").doc(cellId).set({
    cellId,
    trails,
    trailCount: trails.length,
    ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "waymark",
  }).catch((e) => logger.warn("Failed to cache Waymark trails", { cellId, err: String(e) }));
}

// A cached cell is current only if it came from Waymark AND is within the TTL. Older
// cells (or any left over from the previous OSM ingestion) are refreshed from Waymark.
function isCurrent(data: TrailCacheDoc): boolean {
  if (data.source !== "waymark") return false;
  const ageMs = data.ingestedAt ? Date.now() - data.ingestedAt.toMillis() : Infinity;
  return ageMs < TRAIL_CACHE_TTL_MS;
}

/**
 * Hiking trails near a point, sourced from the Waymark GIS with a Firestore cache in
 * front (keyed by 0.1° grid cell, ~11km × 9km). A current cached cell is served
 * directly; a missing or stale cell is fetched live from Waymark and cached. If Waymark
 * is unavailable, any stale cached trails are served rather than nothing.
 */
export async function fetchHikingTrails(
  centerLat: number,
  centerLng: number
): Promise<OsmHike[]> {
  const cellId = gridCellId(centerLat, centerLng);
  const db = admin.firestore();

  try {
    const doc = await db.collection("trails").doc(cellId).get();
    const cached = doc.exists ? (doc.data() as TrailCacheDoc) : null;

    if (cached && isCurrent(cached)) {
      logger.info("Trail cache hit", { cellId, count: cached.trails?.length ?? 0 });
      return cached.trails ?? [];
    }

    // Missing or stale cell → fetch from Waymark (the source of truth) and refresh.
    const live = await fetchWaymarkTrails(centerLat, centerLng);
    if (live.length > 0) {
      logger.info(cached ? "Trail cache refreshed from Waymark" : "Trail cache filled from Waymark", { cellId, count: live.length });
      await cacheTrails(cellId, live);
      return live;
    }

    // Waymark gave nothing — serve stale cache if we have it, else empty.
    if (cached?.trails?.length) {
      logger.info("Waymark empty — serving stale cached trails", { cellId, count: cached.trails.length });
      return cached.trails;
    }
    logger.info("No trail data for cell", { cellId, centerLat, centerLng });
    return [];
  } catch (err) {
    logger.warn("Trail fetch failed", { cellId, err: String(err) });
    return [];
  }
}
