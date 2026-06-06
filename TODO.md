# Wanderly — To-Do List

---

## In-App Purchases (RevenueCat)

- [ ] Create a RevenueCat account at revenuecat.com
- [ ] In **App Store Connect**: create two auto-renewing subscription products
  - `wanderly_pro_monthly` — $4.99/month
  - `wanderly_pro_annual` — $39.99/year
  - Add a subscription group (e.g. "Wanderly Pro") and set the correct free trial / intro offer if desired
- [ ] In **Google Play Console**: create the same two subscription products (same identifiers)
- [ ] In RevenueCat dashboard: create an **Entitlement** named `pro`, attach both products to it
- [ ] Add RevenueCat API keys to `app.json` extra (or `.env`):
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- [ ] Add `react-native-purchases` plugin to `app.json` plugins array (required for native build)
- [ ] Set up **RevenueCat webhook** pointing to `https://us-central1-wanderly-dff52.cloudfunctions.net/revenueCatWebhook`
  - Generate a shared secret in RevenueCat and store it as Firebase secret `REVENUECAT_WEBHOOK_SECRET`
  - `firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET`
- [ ] Deploy updated Cloud Functions: `firebase deploy --only functions`
- [ ] Run the **one-time user migration** to initialize `subscription` and `usage` fields on all existing users
  - Set `ADMIN_MIGRATION_SECRET` as an env var on the function or call it locally with the header
  - `curl -X POST https://us-central1-wanderly-dff52.cloudfunctions.net/migrateUsersToSubscriptionSchema -H "x-admin-secret: <your-secret>"`
- [ ] Test the full purchase flow in **iOS Sandbox** (TestFlight / Simulator)
- [ ] Test the full purchase flow in **Google Play internal track**
- [ ] Verify Firestore `subscription.tier` updates to `pro` after a sandbox purchase (via webhook)
- [ ] Verify paywall appears correctly when a free user hits 3 generations
- [ ] Add **Privacy Policy** and **Terms of Service** URLs to the paywall screen (Apple requires these for subscriptions)

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

## Hiking Trail Ingestion (OSM via GitHub Actions)

Trail data comes from OpenStreetMap via a GitHub Actions scheduled worker — no paid APIs needed.
Firebase functions read from Firestore `trails/` and queue cache misses to `trailIngestionQueue/`.
GitHub Actions runs every 30 min, picks up the queue, calls Overpass, and writes results to Firestore.

### One-time setup

- [ ] Create a Firebase service account with Firestore read/write access:
  - Firebase Console → Project Settings → Service accounts → Generate new private key
  - Save as `scripts/serviceAccount.json` (already in `.gitignore`)
- [ ] Add it as a GitHub repo secret (base64-encoded):
  ```
  cat scripts/serviceAccount.json | base64 | pbcopy
  ```
  Then: GitHub → repo Settings → Secrets → Actions → New secret → `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] The GitHub Actions workflow (`.github/workflows/trail-ingestion.yml`) runs automatically every 30 min
- [ ] **Manual trigger**: GitHub → Actions → "Trail Ingestion Worker" → Run workflow
- [ ] **Manual single-destination ingest** (from your Mac, no GCP IP restriction):
  ```
  node scripts/ingestTrails.js --destination yosemite-us --lat 37.8651 --lng -119.5383
  ```

### How it works

1. User generates an itinerary for a hiking destination → Firebase function checks `trails/{destinationId}`
2. Cache miss → function writes to `trailIngestionQueue/{destinationId}` (status: pending)
3. GitHub Actions runs within ~30 min, calls Overpass (works from GitHub's IPs), writes to `trails/`
4. Next generation for that destination gets real trail data with distances, difficulty, and duration

### Pre-seeded destinations

- `zion-us` — 19 trails already in Firestore

---

## Backend & Infrastructure

- [~] Add **Firebase App Check** to protect Cloud Functions from abuse — CODE DONE (soft-enforce). Remaining: register apps in Firebase Console (App Attest/Play Integrity), add simulator debug token, `firebase deploy --only functions`, rebuild app, then set `APP_CHECK_ENFORCE=true` to hard-enforce
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

- [ ] Write a **Privacy Policy** and host it at a public URL (required by both stores and by Apple for subscriptions)
- [ ] Write **Terms of Service** (required by Apple for subscriptions)
- [ ] Add Privacy Policy and Terms links to the paywall modal and the profile/settings screen
- [ ] Ensure **GDPR compliance** if serving EU users: allow data deletion from profile screen
- [ ] Review affiliate program terms for Booking.com, OpenTable, GYG — some prohibit certain ad types or require disclosure

---

## Product & Polish

- [ ] Add a **"Restore Purchases"** link to the Profile screen (Apple requires this to be visible — already added to PaywallModal, confirm it's also accessible without triggering the paywall)
- [x] Show the **subscription reset date** in Profile (e.g. "Resets June 1")
- [x] Add a **post-generation soft upsell snackbar** (e.g. "Love it? Upgrade for unlimited trips — $4.99/mo") — the plan described this but it wasn't implemented yet
- [ ] Consider a **7-day free trial** for Pro to reduce friction on first purchase (configure in RevenueCat / App Store Connect)
- [x] Add **in-app review prompt** (using `expo-store-review`) after a user successfully generates their first itinerary — timing is perfect there
- [x] Improve the **Places cache key** to include destination + interests, so repeat searches for the same destination in the same interest category hit cache and reduce cost
- [x] Handle the case where generation fails mid-flight but credit was already decremented — add a refund path or only decrement on success (currently decrements before generation starts)

## Itinerary Generation
- [x] Fix activity pills, some of them dont make sense
- [x] Itinerary is sometimes reccomending random stores 
- [x] Do we want to make activity cards clickable to get more info?
- [x] Itinerary sometimes has activities halfway across the country if the city name is the same
- [x] Make cards draggable so they can reorder if they want
- [x] Images do not load on itinerary page sometimes