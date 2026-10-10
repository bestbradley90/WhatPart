# WhatPart

AI-powered automotive parts identification and fitment app.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm install`.
3. Start the app with `npm start`.
4. Open `http://localhost:3000`.

Without an API key, uploads return a clearly labeled demo result. To enable real image identification, copy `.env.example` to `.env`, replace the placeholder with an active OpenAI API key, and restart `npm start`:

```text
OPENAI_API_KEY=your_real_key_here
```

The API key stays on the server and is never sent to the browser. Do not commit or share `.env`; it is ignored by Git. ChatGPT subscriptions and API usage are managed separately, so check API billing if the account has no quota.

## New in latest update

- **Modular catalog adapter** (`catalogAdapter.js`): clean contract, easy to swap providers.
- **Free-tier scan quota**: 8 scans per IP before a soft paywall message (in-memory, resets on restart). Response includes `scansRemaining`.
- **`POST /api/feedback`**: Send `{ correct: true/false, partName, partNumber, notes, vehicle }` to log user corrections. Currently logs to console + in-memory array.
- Improved demo catalog stub that returns candidate cross-references even when no real provider is configured.

## Catalog adapter

The adapter lives in `catalogAdapter.js` and is called from `server.js`.

**Recommended most affordable option right now: PartsTech**
- Genuine free tier ($0) with unlimited parts lookup, suppliers, VIN, diagrams.
- Partner External API for embedding.
- Paid starts around $45–50/mo.
- Signup / docs: https://partstech.com/

To use it:
1. Sign up for PartsTech (start free).
2. Get partner API access / credentials.
3. Set in `.env`:
   ```
   CATALOG_PROVIDER=partstech
   CATALOG_API_URL=https://api.partstech.com/...
   CATALOG_API_KEY=your_key
   ```
4. Fill in the `partsTechLookup` function in `catalogAdapter.js` (currently a stub).

Generic provider also works: just set `CATALOG_PROVIDER`, `CATALOG_API_URL`, and `CATALOG_API_KEY` and return the expected shape.

**Expected response shape**
```js
{
  fitmentSummary: "string",
  crossReferences: [{ partNumber, brand, notes }],
  purchaseLinks: [{ label, url }]  // optional
}
```

Until a real provider is connected, results stay clearly labeled as AI candidates.

## Mobile app setup

The project includes Capacitor configuration for Apple and Android builds. Before syncing a mobile build, set `window.WHATPART_API_URL` in `mobile-api-config.js` to the public HTTPS URL of this Node server. `localhost` only works in the desktop browser on the development computer; it will not work from a phone.

After installing Android Studio or Xcode, use:

```text
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android builds can be prepared on Windows. iOS builds require macOS and Xcode for signing and App Store submission. The default app ID is `com.whatpart.app`; change it before publishing if you need a different permanent identifier.

After each scan, WhatPart provides search links for the selected OEM or aftermarket option on eBay, Amazon, and RockAuto. These links are starting points for purchase research; always confirm the part number and vehicle fitment with the seller before ordering. Affiliate IDs can be added to the link builders in `server.js`.

The scan form also accepts vehicle year, make, model, and engine, and mobile devices can use the rear-camera button while the part is still installed. AI fitment and cross-reference values are candidates until a commercial parts catalog API is connected for exact confirmation.

## Next priorities (in progress)

1. Wire real PartsTech (or other) credentials into the adapter.
2. Persist feedback and scan history (currently in-memory).
3. Add localStorage vehicle garage on the client.
4. Stripe (or RevenueCat) for paid plans that unlock confirmed catalog results and higher limits.
5. Affiliate link upgrades on purchase buttons.
6. Camera UX polish for mobile.
