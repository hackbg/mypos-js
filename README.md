

# myPOS SDK NodeJS

This repository provides a native NodeJS SDK, which enables to integrate your solution with myPOS APIs such as Checkout, Transactions, Devices, Webhooks and more to come.

This is the [Hack.bg](https://hack.bg) maintained fork of [developermypos/mypos-js](https://github.com/developermypos/mypos-js), which has not been updated since 2020. See [CHANGELOG.md](./CHANGELOG.md) for what changed.

### Table of Contents

* [Installation](#installation)
* [Checkout](#checkout)  
  * [Hosted checkout, server-to-server calls and notifications](#hosted-checkout-server-to-server-calls-and-notifications)
  * [Purchase](#purchase)
  * [Refund](#refund)
  * [Reversal](#reversal)
  * [Check Payment Status](#check-payment-status)
* [Transactions](#transactions)
  * [List Transactions](#list-transactions)
  * [Get Transaction Details](#get-transaction-details)
* [Devices](#devices)
  * [List Devices](#list-devices)
  * [Get Device Details](#get-device-details)
  * [List Device Transactions](#list-device-transactions)
  * [List All Devices Transactions](#list-all-devices-transactions)
* [Webhooks](#webhooks)
  * [List Webhooks](#list-webhooks)
  * [Get Webhook Details](#get-webhook-details)
  * [Create a Webhook](#create-a-webhook)
  * [Update a Webhook](#update-a-webhook)
  * [Delete a Webhook](#delete-a-webhook)
  * [List Webhook Events](#list-webhook-events)
  * [Subscribe for an event](#subscribe-for-an-event)
  * [List Event Subscriptions](#list-event-subscriptions)
  * [Get Event Subscription Details](#get-event-subscription-details)
  * [Unsubscribe from an Event](#unsubscribe-from-an-event)
  
  
  
## Installation

Requires Node.js 18.17 or later.

### Install from GitHub
```npm i github:hackbg/mypos-js#v0.1.0```

Install a release tag rather than the default branch. npm records the tag's
commit in `package-lock.json`, so installs stay reproducible. To accept
compatible fixes on `npm update`, use a range instead:
`github:hackbg/mypos-js#semver:^0.1.0`.

### Versioning

This package follows [Semantic Versioning](https://semver.org). Every release
is a `vX.Y.Z` git tag with a GitHub release, and is listed in
[CHANGELOG.md](CHANGELOG.md).

While the version is `0.x`, a **minor** bump (0.1 to 0.2) may break the API and
a **patch** bump (0.1.0 to 0.1.1) never does. npm's caret ranges already treat
`0.x` this way: `^0.1.0` accepts 0.1.x but not 0.2.0. From 1.0.0 on, breaking
changes need a major bump.

Releasing:

1. Move the `Unreleased` entries in CHANGELOG.md under the new version and date.
2. Bump `version` in package.json (`npm version <patch|minor|major> --no-git-tag-version`).
3. Merge to `master`, then tag the merge commit and publish the release:
   `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`, then
   `gh release create vX.Y.Z --notes-from-tag` (or paste the changelog section).

TypeScript declarations are included.

## Checkout
Before calling any of the Checkout API methods, you need to initialize the SDK.
```javascript
const mypos = require('@hackbg/mypos-js')({
    isSandbox: true,
    logLevel: 'info',                   // debug, info, error or none. Debug logs full requests, customer data included.
    checkout: {                         // Checkout API specific configuration
        sid: '',                        // Stored ID
        lang: 'EN',                     // Preferred language
        currency: '',                   // Store currency 
        clientNumber: '',               // Available in the myPOS Account
        okUrl: '',                      // Redirect URL on successful operation
        cancelUrl: '',                  // Redirect URL on cancelled operation
        notifyUrl: '',                  // Callback URL to be notified on operation result (HTTPS, no port)
        cardTokenRequest: 0,            // View details at https://developers.mypos.eu/en/doc/online_payments/v1_4/21-purchase-with-payment-card-(api-call--ipcpurchase) 
        paymentMethod: 1,               // View details at https://developers.mypos.eu/en/doc/online_payments/v1_4/21-purchase-with-payment-card-(api-call--ipcpurchase)
        paymentParametersRequired: 3,   // https://developers.mypos.eu/en/doc/online_payments/v1_4/21-purchase-with-payment-card-(api-call--ipcpurchase)
        keyIndex: 1,                    // Key index for the particular store
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' + // The private key for the particular store in PEM format
            '...\n' +
            '...\n' +
            '...\n' +
            '-----END RSA PRIVATE KEY-----',
        publicCertificate: '-----BEGIN CERTIFICATE-----\n...', // myPOS public certificate, for verifySignature
    }
});
```

### Hosted checkout, server-to-server calls and notifications
These return data instead of HTML, and are the recommended way to use the Checkout API.

```javascript
// The signed IPCPurchase fields and the URL to POST them to. Render them as a
// form in your own page and submit it, keeping the fields in the given order.
const { action, method, fields } = mypos.checkout.purchaseForm(purchaseParams);

// Server-to-server, resolving with myPOS's parsed JSON reply.
const status = await mypos.checkout.paymentStatus({ orderId });  // status.PaymentStatus: 1 paid, 2 pending, 3 failed, 4 reversed
const refund = await mypos.checkout.refundPayment({ trnRef, amount: 9.99 });
const reversal = await mypos.checkout.reversePayment({ trnRef });

// IPCPurchaseNotify / IPCPurchaseOK: check the signature against the myPOS
// public certificate. Pass the parsed form body; field order is preserved.
app.post('/notify', express.urlencoded({ extended: false }), (req, res) => {
    if (!mypos.checkout.verifySignature(req.body) || req.body.IPCmethod !== 'IPCPurchaseNotify') {
        return res.status(400).send('Invalid notification');
    }
    // Look the order up by OrderID and compare Amount and Currency with what
    // you charged, then mark it paid. Do nothing if it is already paid.
    res.type('text/plain').send('OK');
});
```

**Deciding whether an order was paid.** Check that `PaymentStatus` is 1 *and* that `OrderID`, `Amount` and `Currency` match your own record of the order, and verify the reply's signature (`paymentStatus({ orderId }, { verifySignature: true })`, or `verifySignature(reply)`). Do not rely on `StatusMsg === 'Success'` or on `Status`. Observed in production (2026-10-30):

| Order | `Status` / `StatusMsg` | `PaymentStatus` |
|---|---|---|
| paid | `0` / `"Success"` | `1`, with a `PaymentReference` |
| handed to the hosted page, never paid | `0` / `"Success"` | `2`, empty `PaymentReference` |
| unknown to myPOS | `3` / `"No data found"` | absent |

So `StatusMsg` says `"Success"` for an order that was never paid. Production sends numbers (`PaymentStatus: 1`, `Amount: 35`) where the sandbox sends strings (`"1"`, `"35.00"`): compare amounts in cents, not as strings.

**The sandbox reports every order as paid.** In the test environment `IPCGetPaymentStatus` answers `PaymentStatus: "1"`, `StatusMsg: "Success"` with a valid myPOS signature and the requested `OrderID` echoed back, for *any* order: one myPOS has never seen, a checkout that was handed off and abandoned, and a payment the hosted page itself declared unsuccessful. The `Amount` is a random whole number (observed 1.00 to 19.00 EUR), different on every call. So in the sandbox:

- signature, `OrderID`, `Currency` and `PaymentStatus` checks all pass for an unpaid order;
- only the amount check catches it, and only probabilistically: anyone who can make your server repeat the status query can retry until the random amount matches a small order;
- a sandbox status reply is therefore never evidence of payment. Do not let anything that settles orders trust it while `isSandbox` is on, and do not use the sandbox to test your "not paid" path through this call.

(Observed 2026-10-30 with the public test store.) The signed `IPCPurchaseNotify` callback to `URL_Notify` is the stronger settlement signal: myPOS sends it for completed payments, and a payment fails if that URL does not answer `OK`.

**What `verifySignature` proves.** myPOS signs the field *values* only, in order, joined with `-`. Field names and the message type are not signed, so a valid signature proves that myPOS produced this sequence of values at some point, nothing more. In particular:

- the customer's browser receives a signed `IPCPurchaseOK` for their own order and can replay it, including to your `URL_Notify` handler. Check `IPCmethod` is the message you expect on that endpoint;
- check `OrderID`, `Amount` and `Currency` against your own record of the order, never trust them from the message alone;
- treat settlement as idempotent: a second valid notification for an order that is already paid must change nothing.

**Logging.** `logLevel: 'debug'` logs full request fields (customer names, emails, addresses) and full myPOS replies. Use it in development only. Auth headers, OAuth tokens and API keys are never logged at any level.

Each server-to-server call rejects on a network error, a timeout (15 s by default, `{ timeoutMs }` to change) or a reply that is not JSON. A reply with a non-zero `Status` resolves: check it.

The callback-style methods below still work. Note that `purchase` renders a page that submits itself from an inline `onload` handler, which a Content Security Policy without `'unsafe-inline'` blocks, and that `refund`, `reversal` and `getPaymentStatus` only return a signed HTML form: they do not contact myPOS.

### Purchase
#### Gathering purchase data.
```javascript
const purchaseParams = {
    orderId: uuidv4(), // A unique reference
    amount: 23.45,
    cartItems: [
        {
            name: 'HP ProBook 6360b sticker',
            quantity: 2,
            price: 10.00
        },
        {
            name: 'Delivery',
            quantity: 1,
            price: 3.45
        }
    ], 
    customer: {
        email: 'name@website.com',
        firstNames: 'John',
        familyName: 'Smith',
        phone: '+23568956958',
        country: 'DEU',
        city: 'Hamburg',
        zipCode: '20095',
        address: 'Kleine Bahnstr. 41'
    },
    note: 'Some note'
};
```
_Note: The customer object can contain only the customer's **email** and **names** (first and family), however the rest of the information can be required during Checkout._
#### Calling the "Purchase" method.
Now that you have collected the purchase data, call the "purchase" method from the SDK and provide the purchase parameters and the response object. MyPOS will handle the redirect to the Online Checkout page after validating the provided parameters.
```javascript
app.post('/purchase', (req, res) => {
    mypos.checkout.purchase(purchaseParams, res);
});
```
### Refund
#### Gathering refund data.
```javascript
const refundParams = {
    orderId: uuidv4(), // A unique reference
    amount: 9.99,
    trnRef: "MyTransactionReference"
};
```
#### Calling the "Refund" method.
Now that you have collected the refund data, call the "refund" method from the SDK and provide the refund parameters.
```javascript
app.post('/refund', (req, res) => {
    mypos.checkout.refund(refundParams, (result) => {
        res.send(result);
    });
});
```
### Reversal
#### Gathering reversal data.
```javascript
const reversalParams = {
    trnRef: "MyTransactionReference"
};
```
#### Calling the "Reversal" method.
Now that you have collected the reversal data, call the "reversal" method from the SDK and provide the reversal parameters.
```javascript
app.post('/reversal', (req, res) => {
    mypos.checkout.reversal(reversalParams, (result) => {
        res.send(result);
    });
});
```
### Check Payment Status
In order to check the status of a payment, you need to provide myPOS with the order ID.
#### Gathering payment data.
```javascript
const paymentParams = {
    orderId: "MyOrderID"
};
```
#### Calling the "Get Payment Status" method.
Now that you have collected the request data, call the "getPaymentStatus" method from the SDK and provide the required parameters.
```javascript
app.post('/getPaymentStatus', (req, res) => {
    mypos.checkout.getPaymentStatus(paymentParams, (result) => {
        res.send(result);
    });
});
```

The below APIs use a different type of authentication and require a much simpler way of initializing the SDK.
```javascript
const mypos = require('@hackbg/mypos-js')({
    isSandbox: true,    // Whether to use the Sandbox environment
    apiKey: '',         // Generated via the myPOS Account
    apiSecret: '',      // Generated via the myPOS Account
    logLevel: 'info',   // Logging level
});
```
## Transactions
### List Transactions
```javascript
app.get('/transactions', (req, res) => {
    mypos.transactions.list(req.query, (result) => {
        res.send(result);
    });
});
```
### Get Transaction Details
```javascript
app.get('/transactionDetails', (req, res) => {
    mypos.transactions.get('POSA01720049UZNE', (result) => {
        res.send(result);
    });
});
```
## Devices
### List Devices
```javascript
app.get('/devices', (req, res) => {
    mypos.devices.list({
        page: 1,
        count: 5
    }, (result) => {
        res.send(result);
    });
});
```
### Get Device Details
```javascript
app.get('/deviceDetails', (req, res) => {
    mypos.devices.get('90005195', (result) => {
        res.send(result);
    });
});
```
### List Device Transactions
```javascript
app.get('/deviceTransactions', (req, res) => {
    mypos.devices.transactions.get('90004284', {},(result) => {
        res.send(result);
    });
});
```
### List All Devices Transactions
```javascript
app.get('/deviceTransactionsAll', (req, res) => {
    mypos.devices.transactions.list({}, (result) => {
        res.send(result);
    });
});
```

## Webhooks
### List Webhooks
```javascript
app.get('/webhooks', (req, res) => {
    mypos.webhooks.list(req.query, (result) => {
        res.send(result);
    });
});
```
### Get Webhook Details
```javascript
app.get('/webhooks/details', (req, res) => {
    mypos.webhooks.details('d3fca256-ebbc-42d8-9195-d7f0784d546a' /* Webhook ID */, (result) => {
        res.send(result);
    });
});
```
### Create a Webhook
```javascript
app.get('/webhooks/create', (req, res) => {
    mypos.webhooks.create(
        'https://example.com',  // Payload URL
        'my-secret',            // Secret
        (result) => {
            res.send(result);
        });
});
```
### Update a Webhook
```javascript
app.get('/webhooks/update', (req, res) => {
    mypos.webhooks.update(
        'd3fca256-ebbc-42d8-9195-d7f0784d546a', // Webhook ID
        'https://example.com',                  // Payload URL
        'my-secret',                            // Secret
        0,                                      // Active flag 
        (result) => {
            res.send(result);
        });
});
```
### Delete a Webhook
```javascript
app.get('/webhooks/delete', (req, res) => {
    mypos.webhooks.delete(
        'd3fca256-ebbc-42d8-9195-d7f0784d546a', // Webhook ID
        (result) => {
            res.send(result);
        });
});
```
### List Webhook Events
```javascript
app.get('/webhook-events', (req, res) => {
    mypos.webhooks.events.list(req.query, (result) => {
        res.send(result);
    });
});
```
### Subscribe for an Event
```javascript
app.get('/webhooks/subscribe', (req, res) => {
    mypos.webhooks.subscriptions.create(
        'd3fca256-ebbc-42d8-9195-d7f0784d546a', // Webhook ID
        '0c2ac3dd-c62b-404b-ac7f-ac805ea268ff', // Event ID
        (result) => {
            res.send(result);
        });
});
```
### List Event Subscriptions
```javascript
app.get('/webhook-subscriptions', (req, res) => {
    mypos.webhooks.subscriptions.list(
        req.query,
        (result) => {
            res.send(result);
        });
});
```
### Get Event Subscription Details
```javascript
app.get('/webhook-subscriptions/details', (req, res) => {
    mypos.webhooks.subscriptions.details(
        '2b5b37ae-c88a-4563-936d-36d6e8280912', // Subscription ID
        (result) => {
            res.send(result);
        });
});
```
### Unsubscribe from an Event
```javascript
app.get('/webhooks/unsubscribe', (req, res) => {
    mypos.webhooks.subscriptions.delete(
        '18912b44-5c37-45ea-b933-103ff813cb71', // Subscription ID
        (result) => {
            res.send(result);
        });
});
```
