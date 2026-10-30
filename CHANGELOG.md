# Changelog

## 0.1.0

Maintained fork of developermypos/mypos-js 0.0.5.

### Added
- `checkout.purchaseForm(params)`: the signed IPCPurchase fields and URL, for
  rendering the hosted-checkout handoff yourself.
- `checkout.paymentStatus`, `checkout.refundPayment`, `checkout.reversePayment`:
  server-to-server calls that actually contact myPOS and resolve with the
  parsed JSON reply.
- `checkout.verifySignature(data, publicCertificate?)` for IPCPurchaseNotify,
  IPCPurchaseOK and server replies. `checkout.publicCertificate` is the default
  certificate.
- TypeScript declarations (`index.d.ts`) and a test suite (`npm test`).

### Fixed
- OAuth tokens never expired: the current time was read once, when the module
  loaded.
- OAuth token generation threw on every call, parsing an already parsed reply.
- `webhooks.create` sent the secret as the payload URL and no secret.
- `walletnumber` was read from `params.sid` instead of `params.walletNumber`
  on every checkout request.
- Optional fields that were not given were sent as the string `"undefined"`.
  They are now omitted.
- Amounts are sent with two decimals. `Amount_N` was a float product, e.g.
  `59.97000000000001` for 3 x 19.99.
- Instances shared one configuration object, so a second `MyPos(...)` call
  overwrote the first one's settings.
- `logLevel` was ignored and everything was logged, including bearer tokens and
  full request parameters. Debug now logs requests without auth headers, and
  tokens are never logged.
- The legacy HTML form now escapes its values (a `"` in a product name broke
  the form, and markup could be injected), declares UTF-8, and sets a
  `Content-Type` when written to a response.

### Changed
- Signing uses Node's `crypto` instead of `node-rsa`. Signatures are identical
  (RSA-SHA256, PKCS#1 v1.5).
- Dependencies reduced to `@cypress/request`. Removed `node-rsa`, `uuid`,
  `enum` (unused) and `net` (an npm placeholder shadowing the Node builtin).
- Package renamed to `@hackbg/mypos-js`. Requires Node.js 18.17+.

### Upgrade notes
- **If you parse the HTML from `purchase(...)`** to re-render the form (to work
  around CSP), its values are now HTML-escaped. Decode them, or better, switch
  to `purchaseForm`, which returns the raw fields. Re-escaping escaped values
  changes what the browser posts and the signature no longer matches.
- If you relied on `"undefined"` being posted for missing customer fields,
  those fields are now absent.
