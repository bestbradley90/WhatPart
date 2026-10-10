# WhatPart

AI-powered automotive parts identification and fitment app.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm install`.
3. Start the app with `npm start`.
4. Open `http://localhost:3000`.

Without an API key, uploads return a clearly labeled demo result. To enable real image identification, copy `.env.example` to `.env`, replace the placeholder with an active OpenAI API key, and restart `npm start`.

## Latest cleanup

- Server cleaned: tighter code, clearer messages, affiliate params from env.
- New `www/smooth.js`: adds Correct/Wrong feedback buttons after a scan, shows free scans remaining, and persists vehicle fields in localStorage.

To activate the smoother client features, add this line before `</body>` in `index.html`:

```html
<script src="/www/smooth.js"></script>
```

## Catalog adapter

See `catalogAdapter.js`. Recommended: PartsTech free tier.

## Affiliate links

Set these in `.env` after joining the programs:
- `AFFILIATE_EBAY_CAMPID`
- `AFFILIATE_AMAZON_TAG`
- `AFFILIATE_ROCKAUTO`

Purchase links will automatically include your tracking.

## Next

Wire real catalog credentials, persist data beyond in-memory, add paid tier.
