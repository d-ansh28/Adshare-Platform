# AdShare — multi-LLM sponsored ad rewards (starter)

A runnable starter containing:
- Chrome Manifest V3 extension for ChatGPT, Gemini and Claude
- Express API with SQLite persistence
- Advertiser and admin dashboards
- Campaign payment review flow using the supplied Razorpay.me profile URL
- Impression ledger, user balances and manual UPI withdrawal workflow

## Important payment limitation
The supplied `https://razorpay.me/@Presently` profile link is a hosted profile/payment page, not a programmable Payment Links API. This app calculates the campaign total and redirects to that URL, but cannot prefill/lock the amount or verify payment automatically. Advertisers must pay the displayed amount and submit the payment reference; an admin verifies it in the Razorpay dashboard before approving the campaign. Never trust a browser redirect as proof of payment.

For automatic verification later, create individual Razorpay Payment Links through the API and validate `payment_link.paid` webhooks (or fetch the link server-side). Docs: https://razorpay.com/docs/payments/payment-links/apis/ and https://razorpay.com/docs/webhooks/

## Pricing defaults
- Text: advertiser ₹1 / approved show; user reward ₹0.10
- Image: advertiser ₹5 / approved show; user reward ₹0.50
- Video: advertiser ₹10 / approved show; user reward ₹1.00
- Minimum withdrawal: ₹1,000

These are configurable in `server/src/config.js`. Rewards are credited once per verified impression. A campaign's approved show count is a hard cap.

## Run locally
1. Install Node.js 20+.
2. `cd server && npm install`
3. Copy `.env.example` to `.env`, set strong secrets and admin credentials.
4. `npm run dev`
5. Open `http://localhost:3000` for advertiser dashboard and `/admin.html` for admin.
6. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, select `extension/`.
7. Set the API URL in the extension popup to `http://localhost:3000`.

Default admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first startup. Change both before deployment.

## Extension setup
The extension currently injects into supported first-party chat interfaces only. DOM structures change often, so selectors are best-effort. Ads are visually labelled Sponsored, open the advertiser's click-through URL in a new tab, and are displayed in a non-blocking card while generation is detected. The extension does not read or modify prompts or model responses.

## Deploy
Deploy the Express server with persistent disk storage for `server/data/adshare.sqlite`. Set `PUBLIC_BASE_URL` to the HTTPS server URL. Load the extension unpacked for testing; Chrome Web Store publication requires a separate review.

## Production hardening before taking real money
- Obtain legal/accounting advice for ad-funded rewards, GST, TDS, consumer disclosures and platform policies.
- Complete Razorpay business onboarding and use individual Payment Links + signed webhooks for automated verification.
- Add email/phone verification, rate limits, CAPTCHA, device risk checks, audit log retention, support and refund/dispute handling.
- Do not promise guaranteed ad visibility. A campaign is billed for accepted impressions only, and unspent funds need a refund/credit policy.
- Validate every creative and destination URL; prohibit malware, deceptive, adult, illegal and prohibited products.
- Keep user reward balances as a ledger, not editable client-side values. This starter uses server-side ledger transactions and SQLite transactions but is not a substitute for a production financial ledger/audit review.
