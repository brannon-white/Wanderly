#!/usr/bin/env bash
# Downloads each US state's OSM PBF from Geofabrik, filters hiking routes,
# and uploads trail data to Firestore via uploadOsmXml.js.
#
# Usage:
#   ./scripts/ingestAllStates.sh [state-name ...]
#
# Examples:
#   ./scripts/ingestAllStates.sh               # process all remaining states
#   ./scripts/ingestAllStates.sh colorado arizona   # process specific states
#
# Completed states are tracked in scripts/.ingest_progress so you can
# interrupt and resume at any time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROGRESS_FILE="$SCRIPT_DIR/.ingest_progress"
TMP_DIR="$REPO_ROOT/.osm_tmp"
GEOFABRIK_BASE="https://download.geofabrik.de/north-america/us"

# All 50 states + DC using Geofabrik slug names
ALL_STATES=(
  alabama alaska arizona arkansas california colorado connecticut
  delaware district-of-columbia florida georgia hawaii idaho illinois
  indiana iowa kansas kentucky louisiana maine maryland massachusetts
  michigan minnesota mississippi missouri montana nebraska nevada
  new-hampshire new-jersey new-mexico new-york north-carolina north-dakota
  ohio oklahoma oregon pennsylvania rhode-island south-carolina south-dakota
  tennessee texas utah vermont virginia washington west-virginia wisconsin wyoming
)

# ── Argument handling ────────────────────────────────────────────────────────
if [[ $# -gt 0 ]]; then
  STATES=("$@")
else
  STATES=("${ALL_STATES[@]}")
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
is_done() { grep -qxF "$1" "$PROGRESS_FILE" 2>/dev/null; }
mark_done() { echo "$1" >> "$PROGRESS_FILE"; }

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$TMP_DIR"
touch "$PROGRESS_FILE"

echo ""
echo "=== Wanderly trail ingest: ${#STATES[@]} state(s) ==="
echo "Progress file: $PROGRESS_FILE"
echo "Temp dir:      $TMP_DIR"
echo ""

for STATE in "${STATES[@]}"; do
  if is_done "$STATE"; then
    echo "[$STATE] Already done — skipping."
    continue
  fi

  echo "──────────────────────────────────────────"
  echo "[$STATE] Starting..."

  PBF_FILE="$TMP_DIR/${STATE}-latest.osm.pbf"
  HIKING_PBF="$TMP_DIR/${STATE}-hiking.osm.pbf"
  HIKING_XML="$TMP_DIR/${STATE}-hiking.osm"

  # 1. Download
  if [[ ! -f "$PBF_FILE" ]]; then
    echo "[$STATE] Downloading from Geofabrik..."
    curl -L --retry 3 --retry-delay 5 --progress-bar \
      -o "$PBF_FILE" \
      "${GEOFABRIK_BASE}/${STATE}-latest.osm.pbf"
  else
    echo "[$STATE] PBF already downloaded, reusing."
  fi

  # 2. Filter hiking routes
  echo "[$STATE] Filtering hiking routes..."
  osmium tags-filter "$PBF_FILE" r/route=hiking r/route=foot -o "$HIKING_PBF" --overwrite

  # 3. Convert to XML
  echo "[$STATE] Converting to OSM XML..."
  osmium cat "$HIKING_PBF" -o "$HIKING_XML" --output-format=osm --overwrite

  # 4. Upload to Firestore
  echo "[$STATE] Uploading to Firestore..."
  node "$SCRIPT_DIR/uploadOsmXml.js" --file "$HIKING_XML"

  # 5. Clean up temp files for this state
  rm -f "$PBF_FILE" "$HIKING_PBF" "$HIKING_XML"
  echo "[$STATE] Cleaned up temp files."

  mark_done "$STATE"
  echo "[$STATE] Done."
  echo ""
done

echo "=== All states processed ==="
