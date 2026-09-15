# WhatPart

AI-powered automotive parts identification and fitment app.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm install`.
3. Start the app with `npm start`.
4. Open `http://localhost:3000`.

Without an API key, uploads return a clearly labeled demo result. To enable real image identification, create a `.env` file with:

```text
OPENAI_API_KEY=your_key_here
```

The API key stays on the server and is never sent to the browser.

## Mobile app setup

The project includes Capacitor configuration for Apple and Android builds. Before syncing a mobile build, set `window.WHATPART_API_URL` in `mobile-api-config.js` to the public HTTPS URL of this Node server. `localhost` only works in the desktop browser on the development computer; it will not work from a phone.

After installing Android Studio or Xcode, use:

```text
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android builds can be prepared on Windows. iOS builds require macOS and Xcode for signing and App Store submission. The default app ID is `com.whatpart.app`; change it before publishing if you need a different permanent identifier.

After each scan, WhatPart provides search links for the selected OEM or aftermarket option on eBay, Amazon, and RockAuto. These links are starting points for purchase research; always confirm the part number and vehicle fitment with the seller before ordering.

The scan form also accepts vehicle year, make, model, and engine, and mobile devices can use the rear-camera button while the part is still installed. AI fitment and cross-reference values are candidates until a commercial parts catalog API is connected for exact confirmation.

## Catalog provider plan

For exact vehicle fitment, interchange, inventory, and purchasing, connect one licensed catalog provider through the adapter settings in `.env`:

- **PartsTech / OEC**: strong North American supplier coverage and ordering workflows for repair shops.
- **WHI Solutions / Nexpart**: commercial aftermarket and OE catalog/e-commerce data for distributors and suppliers.
- **Epicor aftermarket**: established commercial catalog and parts data used by automotive businesses.
- **Auto Care ACES/PIES**: industry data standards for normalizing fitment and product information when you license data directly from manufacturers or a data provider.

Set `CATALOG_PROVIDER`, `CATALOG_API_URL`, and `CATALOG_API_KEY` after choosing a provider and receiving its API contract. The adapter sends `{ vehicle, partName, partNumber, source }` and expects normalized `fitmentSummary`, `crossReferences`, and optional `purchaseLinks` in return. Provider credentials and exact endpoint formats are commercial, so the app does not guess or scrape them. Until configured, the app clearly labels results as AI candidates.