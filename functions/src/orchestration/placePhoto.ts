// Builds the URL the client loads for a Google Places photo. We never embed the
// Places API key in a client-facing URL, so images go through our placePhotoHttp
// proxy, which resolves the keyless googleusercontent media URL server-side and
// 302-redirects to it (with long cache headers). `name` is the Places photo resource
// id, e.g. "places/ChIJ.../photos/AeJ...".
const FN_BASE = "https://us-central1-wanderly-dff52.cloudfunctions.net";

export function placePhotoUrl(name: string | undefined, maxWidthPx = 800): string {
  if (!name) return "";
  return `${FN_BASE}/placePhotoHttp?name=${encodeURIComponent(name)}&w=${maxWidthPx}`;
}
