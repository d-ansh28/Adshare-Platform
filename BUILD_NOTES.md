# Build notes / limitations

- The advertiser portal is served at `/`; admin portal at `/admin.html`.
- Advertiser registration creates an account that can also sign into the extension to earn. Admin is a separate role created from environment variables.
- The extension currently injects one small Sponsored card when generation is detected on ChatGPT, Gemini or Claude. Site DOM selectors change frequently; verify and adjust on each target website before publishing.
- A view is counted after the card remains in the page for 2.5 seconds and the API accepts a unique impression key. This is a basic MVP rule, not robust proof of human attention. For real money, add server-issued signed view sessions, stronger bot/device checks, daily caps and manual fraud review.
- The supplied Razorpay.me profile URL is opened as-is. It cannot be trusted to accept a dynamic amount query string or return a verifiable transaction. The campaign amount is shown in the advertiser portal; payment reference is entered after payment. Admin must verify the actual received amount in Razorpay and choose approved shows consistent with the amount received.
- Do not activate production campaigns until the payment, ad review, reward ledger, refund, privacy, consent and compliance workflows have been reviewed.
