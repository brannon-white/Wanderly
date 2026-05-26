/**
 * Shared Overpass API fetch + OSM trail parsing utilities.
 * Used by ingestTrails.js (CLI) and processTrailQueue.js (queue worker).
 *
 * Designed to run OUTSIDE GCP — GitHub Actions runners and VPS machines
 * can reach Overpass freely. Firebase Functions cannot (GCP IPs are rate-limited).
 */

const https = require("https");

const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT = "Wanderly/1.0 (travel planning app; https://wanderly.app)";

function httpsPost(url, body, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(body);
    req.end();
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function simplifyCoords(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const result = [];
  for (let i = 0; i < coords.length; i += step) result.push(coords[i]);
  const last = coords[coords.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

const JUNK_NAMES = new Set(["connector trail", "connector", "path", "track"]);

/**
 * Parse raw Overpass relation elements into OsmHike objects.
 * @param {any[]} elements - raw Overpass response elements
 * @param {string} destinationId - Firestore document ID
 * @param {number} fallbackLat - center lat if element has no center
 * @param {number} fallbackLng - center lng if element has no center
 */
function parseTrails(elements, destinationId, fallbackLat, fallbackLng) {
  const trails = [];

  for (const el of elements) {
    if (el.type !== "relation" || !el.tags || !el.members) continue;

    const name = el.tags["name"]?.trim();
    if (!name) continue;
    if (JUNK_NAMES.has(name.toLowerCase())) continue;

    let totalKm = 0;
    const allCoords = [];
    for (const member of el.members) {
      if (member.type !== "way" || !member.geometry || member.geometry.length < 2) continue;
      for (let i = 0; i < member.geometry.length - 1; i++) {
        const a = member.geometry[i];
        const b = member.geometry[i + 1];
        totalKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
        allCoords.push([a.lon, a.lat]);
      }
      const last = member.geometry[member.geometry.length - 1];
      allCoords.push([last.lon, last.lat]);
    }

    if (totalKm < 0.4) continue;

    const distanceMiles = Math.round(totalKm * 0.621371 * 10) / 10;
    const estimatedDurationHours = Math.round((distanceMiles / 2) * 10) / 10;

    let difficulty;
    if (distanceMiles < 2) difficulty = "easy";
    else if (distanceMiles <= 6) difficulty = "moderate";
    else difficulty = "hard";

    let category;
    if (distanceMiles < 2) category = "walk";
    else if (distanceMiles <= 6) category = "moderate_hike";
    else category = "major_hike";

    const ascentM = el.tags["ascent"] ? parseFloat(el.tags["ascent"]) : null;
    const elevationGainFt = ascentM ? Math.round(ascentM * 3.28084) : null;

    const simplified = simplifyCoords(allCoords, 200);
    const startCoord = allCoords[0];
    const endCoord = allCoords[allCoords.length - 1];

    trails.push({
      id: String(el.id),
      destinationId,
      name,
      distanceMiles,
      estimatedDurationHours,
      elevationGainFt,
      difficulty,
      category,
      tags: Object.entries(el.tags)
        .filter(([k]) => ["surface", "sac_scale", "trail_visibility", "access"].includes(k))
        .map(([k, v]) => `${k}:${v}`),
      coordinates: {
        start: startCoord ? { lat: startCoord[1], lng: startCoord[0] } : { lat: fallbackLat, lng: fallbackLng },
        end: endCoord ? { lat: endCoord[1], lng: endCoord[0] } : { lat: fallbackLat, lng: fallbackLng },
      },
      centerLat: el.center?.lat ?? (allCoords.length > 0 ? allCoords[Math.floor(allCoords.length / 2)][1] : fallbackLat),
      centerLng: el.center?.lon ?? (allCoords.length > 0 ? allCoords[Math.floor(allCoords.length / 2)][0] : fallbackLng),
      geometry: {
        type: "LineString",
        coordinates: simplified,
      },
      source: "osm",
      osmId: el.id,
    });
  }

  const seen = new Set();
  return trails.filter((t) => {
    const key = t.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { OVERPASS_URLS, USER_AGENT, httpsPost, haversineKm, parseTrails, simplifyCoords };
