# Wanderly — To-Do List

---

## In-App Purchases (RevenueCat)

**Status: integration is built and live in the codebase** — `services/purchases.ts`,
`PaywallModal`, `revenueCatWebhook` + `migrateUsersToSubscriptionSchema` Cloud Functions,
`subscription`/`usage` schema, and credit-pack handling all exist. The items below that
remain are the **external dashboard / store-side** steps that can't be verified from the repo.

- [x] Create a RevenueCat account (iOS public key is wired in `StickerSmash/.env`)
- [x] Create two auto-renewing subscription products (`wanderly_pro_monthly`, `wanderly_pro_annual`)
- [x] In RevenueCat dashboard: create an **Entitlement** named `pro`, attach both products
- [x] Add `react-native-purchases` plugin + iOS RevenueCat key
- [ ] **Add the ANDROID RevenueCat key** — `.env` only has `EXPO_PUBLIC_REVENUECAT_IOS_KEY`; `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` is still missing (needed for Play Store IAP)
- [ ] In **Google Play Console**: create the same two subscription products (same identifiers)
- [x] **RevenueCat webhook** built (`revenueCatWebhook`, auth via `REVENUECAT_WEBHOOK_SECRET`)
- [x] **One-time user migration** function built (`migrateUsersToSubscriptionSchema`, gated by `ADMIN_MIGRATION_SECRET`)
- [x] Add **Privacy Policy** and **Terms of Use** URLs to the paywall (`constants/legal.ts`, shown in `PaywallModal`)
- [ ] (External) Confirm `REVENUECAT_WEBHOOK_SECRET` + `ADMIN_MIGRATION_SECRET` are set as Firebase secrets in prod and the migration has been run
- [ ] (External) Test the full purchase flow in **iOS Sandbox** (TestFlight / Simulator)
- [ ] (External) Test the full purchase flow in **Google Play internal track**
- [ ] (External) Verify Firestore `subscription.tier` flips to `pro` after a sandbox purchase (via webhook)

---

## Affiliate Links

- [ ] **Booking.com** — Sign up at booking.com/affiliate-program, get your AID, paste into `BOOKING_COM_AID` in `StickerSmash/services/bookingService.ts`
- [ ] **OpenTable** — Sign up at cj.com (Commission Junction), search for "OpenTable" advertiser, apply, get your affiliate ID, paste into `OPENTABLE_AID`
- [ ] **GetYourGuide** — Sign up at partner.getyourguide.com, get your partner ID, paste into `GYG_PARTNER_ID`
- [ ] Test all three deep links from an itinerary to verify affiliate params are appended
- [ ] Consider adding **Viator** (TripAdvisor's experiences platform) as an alternative/supplement to GetYourGuide — often better commission rates
- [ ] Consider **Skyscanner or Google Flights** affiliate for flight search links (no current integration)

---

## App Store & Google Play Setup

- [x] Add Android `package` identifier to `app.json` under `android` (currently missing — needed for Play Store)
  - e.g. `"package": "com.appsmadehere.wanderly"`
- [ ] Create a **Google Play Console** account and app listing
- [ ] Create **App Store Connect** listing (if not already created)
- [ ] Add required subscription **review screenshots** for App Store review
- [ ] Write **app description**, keywords, and screenshots for both stores
- [ ] Set up **App Store privacy labels** (data types collected: name, email, purchase history, usage data)
- [ ] Set up **Google Play data safety form** (same categories)
- [ ] Configure **EAS Build** for production builds (`eas build --platform all --profile production`)
- [ ] Set up **EAS Submit** for automated store submission

---

## Hiking Trails (Waymark GIS)

Trail data comes from the **Waymark GIS API** (`/api/wanderly/trails/nearby`) — a curated,
deduped dataset (OSM + NPS + Geofabrik). Firestore `trails/` is just a fast cache in front of it.

### How it works ([trailDiscovery.ts](functions/src/orchestration/trailDiscovery.ts))

1. Generation calls `fetchHikingTrails(lat, lng)`, keyed by 0.1° grid cell (~11km).
2. **Current cached cell** (Waymark-sourced, < 30-day TTL) → served directly.
3. **Missing or stale cell** → fetched live from Waymark and cached.
4. **Waymark down/empty** → any stale cached trails are served rather than nothing (10s timeout, fail-soft).

### Config

- Base URL defaults to `https://waymark-api.onrender.com`; override with the `WAYMARK_API_URL`
  env var (e.g. in `functions/.env`) if self-hosted.
- No auth required — the `/wanderly` endpoint is public.

> The old OSM/Overpass ingestion pipeline (GitHub Actions worker, `scripts/ingestTrails.js`,
> `trailIngestionQueue`) was removed once Waymark became the source of truth.

---

## Backend & Infrastructure

- [~] Add **Firebase App Check** to protect Cloud Functions from abuse — CODE DONE (soft-enforce). App is registered in the Firebase Console (confirmed in Apps section). Remaining to HARD-enforce: confirm the attestation provider is set per platform (App Attest/DeviceCheck for iOS, Play Integrity for Android), add a debug token for simulator/dev builds, then set `APP_CHECK_ENFORCE=true` and `firebase deploy --only functions`
  - ⚠️ **App Check → APIs tab** (separate from the code flag above): **leave `Places API (New)` UNENFORCED** — it's called server-side from Cloud Functions with an API key, so enforcing it would reject those calls and **break itinerary generation**. The client uses the native Maps SDK only (not Places API directly). The ONLY candidates worth enforcing there are **Cloud Firestore** and **Cloud Storage** (the client hits them directly), and only after their App Check metrics show ~100% verified traffic. Leave everything else (Maps JS, Auth, RTDB, AI Logic, SQL Connect, Google Identity) Unenforced.
- [x] Set **Google Cloud billing alerts** for the Places API — $50/mo budget "Wanderly Monthly" (alerts 50/90/100%) + hard daily quota caps: SearchNearby 5,000/day, SearchText 2,000/day
- [ ] Add per-IP or per-user **rate limiting** on Cloud Functions (currently only `maxInstances: 10`)
- [x] Review and tighten **Firestore security rules** — ensure `subscription` and `usage` fields can only be written by Cloud Functions, not the client
- [ ] Rotate any exposed API keys (check git history for accidental commits)
- [ ] Set `ADMIN_MIGRATION_SECRET` and `REVENUECAT_WEBHOOK_SECRET` as Firebase secrets before deploying

---

## Analytics & Monitoring

- [x] Add **Firebase Analytics** events for key user actions:
  - `itinerary_generated`, `paywall_shown`, `purchase_started`, `purchase_completed`, `regen_attempted`
- [ ] Set up **Firebase Crashlytics** for crash reporting (the MCP tool is already configured)
- [ ] Set up a **conversion funnel** in Firebase: search → trip review → paywall shown → purchased
- [ ] Add **revenue tracking** in RevenueCat dashboard (it does this automatically once purchases flow)

---

## Legal & Compliance

- [x] Write a **Privacy Policy** and host it at a public URL — live at `https://wanderly-dff52.web.app/privacy` (source in `legal/public/`)
- [x] Write **Terms of Service / Use** — live at `https://wanderly-dff52.web.app/terms`
- [x] Add Privacy Policy and Terms links to the paywall modal and the profile screen (`constants/legal.ts`, used in `PaywallModal` + `profileScreen`)
- [x] Ensure **GDPR compliance**: in-app account + data deletion — `deleteAccountHttp` Cloud Function (recursive Firestore wipe + Auth user delete) and a "Delete Account" flow on the Profile screen (`services/account.ts`). ⚠️ **Must deploy `deleteAccountHttp` before App Store submission** — Apple tests account deletion during review, and the button errors until the function is live.
- [ ] Review affiliate program terms for Booking.com, OpenTable, GYG — some prohibit certain ad types or require disclosure

---

## Product & Polish

- [x] Add a **"Restore Purchases"** link to the Profile screen — present in both `PaywallModal` and `profileScreen` (accessible without triggering the paywall)
- [x] Show the **subscription reset date** in Profile (e.g. "Resets June 1")
- [x] Add a **post-generation soft upsell snackbar** (e.g. "Love it? Upgrade for unlimited trips — $4.99/mo") — the plan described this but it wasn't implemented yet
- [ ] Consider a **7-day free trial** for Pro to reduce friction on first purchase (configure in RevenueCat / App Store Connect)
- [x] Add **in-app review prompt** (using `expo-store-review`) after a user successfully generates their first itinerary — timing is perfect there
- [x] Improve the **Places cache key** to include destination + interests, so repeat searches for the same destination in the same interest category hit cache and reduce cost
- [x] Handle the case where generation fails mid-flight but credit was already decremented — add a refund path or only decrement on success (currently decrements before generation starts)

## Itinerary Generation
- [x] Fix activity pills, some of them dont make sense
- [x] Itinerary is sometimes reccomending random stores
  - Hardened further: `isJunkVenue` filter drops gas stations / dollar stores / banks / pharmacies / gyms from candidate pools, nearby/text search, and the place-resolution match (`orchestration/placeQuality.ts`)
- [x] Do we want to make activity cards clickable to get more info?
- [x] Itinerary sometimes has activities halfway across the country if the city name is the same
- [x] Make cards draggable so they can reorder if they want
- [x] Images do not load on itinerary page sometimes
- [x] **Multi-day road trips: fixed hallucinated/overlapping times across the inter-city drive** — drive days are re-timed deterministically so the clock is consistent and the drive happens in daylight, not at 8 PM (`orchestration/directions.ts`)
- [x] **Cap hikes/trails at ONE per day** — more than one is flagged fatal and repaired (`orchestration/validation.ts`)
- [x] **Drive days now include a real arrival-city sight + dinner** — no more "travel day = two restaurants back-to-back" (`orchestration/driveDayShaping.ts`)
- [x] **"Rework Schedule" button fixed** — now deterministically re-flows the day's times AND preserves Waymark trail data (previously it regenerated the trail as a plain AI activity and didn't fix the timing). New `reflowDayScheduleHttp` endpoint + `reflowDaySchedule`.