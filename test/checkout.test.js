'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const MyPos = require('../mypos');
const AuthToken = require('../resources/auth/auth-token');
const CreateWebHookRequest = require('../resources/webHooks/create-webhook');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const sdk = (checkout = {}) => MyPos({
    isSandbox: true,
    logLevel: 'none',
    checkout: {
        sid: '000000000000010',
        lang: 'BG',
        currency: 'EUR',
        clientNumber: '61938166610',
        okUrl: 'https://shop.example/ok',
        cancelUrl: 'https://shop.example/cancel',
        notifyUrl: 'https://shop.example/notify',
        cardTokenRequest: 0,
        paymentMethod: 1,
        paymentParametersRequired: 3,
        keyIndex: 1,
        privateKey,
        publicCertificate: publicKey,
        ...checkout,
    },
});

const purchase = {
    orderId: 'order-1',
    amount: 62.42,
    cartItems: [
        { name: 'Jacket "Rain" <b>', quantity: 3, price: 19.99 },
        { name: 'Delivery', quantity: 1, price: 2.45 },
    ],
    customer: { email: 'name@example.com' },
    okUrl: 'https://shop.example/ok?a=1&b=2',
};

const field = (fields, name) => (fields.find(([key]) => key === name) || [])[1];

test('purchaseForm signs the fields it returns, Signature last', () => {
    const mypos = sdk();
    const { action, method, fields } = mypos.checkout.purchaseForm(purchase);

    assert.equal(action, 'https://www.mypos.com/vmp/checkout-test');
    assert.equal(method, 'POST');
    assert.equal(fields[fields.length - 1][0], 'Signature');
    assert.equal(mypos.checkout.verifySignature(fields), true);
});

test('a changed value fails verification', () => {
    const mypos = sdk();
    const { fields } = mypos.checkout.purchaseForm(purchase);
    const tampered = fields.map(([key, value]) => [key, key === 'Amount' ? '0.01' : value]);

    assert.equal(mypos.checkout.verifySignature(tampered), false);
    assert.equal(mypos.checkout.verifySignature(fields, 'not a certificate'), false);
});

test('optional fields that were not given are omitted, not sent as "undefined"', () => {
    const { fields } = sdk().checkout.purchaseForm(purchase);

    assert.equal(fields.some(([, value]) => value === 'undefined'), false);
    assert.equal(field(fields, 'customerphone'), undefined);
    assert.equal(field(fields, 'Note'), undefined);
    assert.equal(field(fields, 'customeremail'), 'name@example.com');
});

test('money is sent with two decimals and without float artefacts', () => {
    const { fields } = sdk().checkout.purchaseForm(purchase);

    assert.equal(field(fields, 'Amount'), '62.42');
    assert.equal(field(fields, 'Price_1'), '19.99');
    assert.equal(field(fields, 'Amount_1'), '59.97');
    assert.equal(field(fields, 'Amount_2'), '2.45');
});

test('walletnumber comes from clientNumber, not from sid', () => {
    const { fields } = sdk().checkout.purchaseForm({ ...purchase, sid: '999' });

    assert.equal(field(fields, 'SID'), '999');
    assert.equal(field(fields, 'walletnumber'), '61938166610');
});

test('the legacy HTML form escapes values', () => {
    let html = '';
    sdk().checkout.purchase(purchase, (out) => {
        html = out;
    });

    assert.match(html, /value="Jacket &quot;Rain&quot; &lt;b&gt;"/);
    assert.match(html, /value="https:\/\/shop\.example\/ok\?a=1&amp;b=2"/);
    assert.match(html, /accept-charset="utf-8"/);
});

test('the legacy form sets a content type when given a response', () => {
    const headers = {};
    let body = '';
    sdk().checkout.purchase(purchase, {
        headersSent: false,
        setHeader: (name, value) => {
            headers[name] = value;
        },
        write: (chunk) => {
            body += chunk;
        },
        end: () => {},
    });

    assert.equal(headers['Content-Type'], 'text/html; charset=utf-8');
    assert.match(body, /ipcForm/);
});

test('instances do not share configuration', () => {
    const a = sdk();
    const b = MyPos({ apiKey: 'key', apiSecret: 'secret' });

    assert.equal(a.config.isSandbox, true);
    assert.equal(b.config.isSandbox, false);
    assert.equal(b.config.checkout, undefined);
});

test('paymentStatus posts the signed request and resolves with the JSON reply', async (t) => {
    const calls = [];
    t.mock.method(global, 'fetch', async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ Status: 0, PaymentStatus: 1, OrderID: 'order-1' }), { status: 200 });
    });

    const mypos = sdk();
    const reply = await mypos.checkout.paymentStatus({ orderId: 'order-1' });

    assert.equal(reply.PaymentStatus, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://www.mypos.com/vmp/checkout-test');
    const sent = [...new URLSearchParams(calls[0].init.body)];
    assert.equal(field(sent, 'IPCmethod'), 'IPCGetPaymentStatus');
    assert.equal(field(sent, 'OrderID'), 'order-1');
    assert.equal(field(sent, 'OutputFormat'), 'JSON');
    assert.equal(mypos.checkout.verifySignature(sent), true);
});

test('server-to-server calls reject on HTTP errors and non-JSON replies', async (t) => {
    const replies = [new Response('down', { status: 502 }), new Response('<xml/>', { status: 200 })];
    t.mock.method(global, 'fetch', async () => replies.shift());

    const mypos = sdk();
    await assert.rejects(mypos.checkout.paymentStatus({ orderId: 'x' }), /HTTP 502/);
    await assert.rejects(mypos.checkout.refundPayment({ trnRef: '1', amount: 5 }), /non-JSON/);
});

test('refundPayment sends the transaction reference and a formatted amount', async (t) => {
    let body = '';
    t.mock.method(global, 'fetch', async (url, init) => {
        body = init.body;
        return new Response(JSON.stringify({ Status: 0 }), { status: 200 });
    });

    await sdk().checkout.refundPayment({ trnRef: '12345', amount: 9.9, orderId: 'refund-1' });
    const sent = [...new URLSearchParams(body)];

    assert.equal(field(sent, 'IPCmethod'), 'IPCRefund');
    assert.equal(field(sent, 'IPC_Trnref'), '12345');
    assert.equal(field(sent, 'Amount'), '9.90');
    assert.equal(field(sent, 'Currency'), 'EUR');
});

test('an OAuth token expires relative to when it was issued', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000_000 });
    const token = new AuthToken({ access_token: 't', token_type: 'Bearer', expires_in: 3600 });
    assert.equal(token.isExpired, false);

    t.mock.timers.tick(3600 * 1000);
    assert.equal(token.isExpired, true);
});

test('creating a webhook sends the payload URL and the secret in the right fields', () => {
    const request = new CreateWebHookRequest(sdk(), 'https://shop.example/hook', 's3cret');

    assert.deepEqual(request.reqData, { payload_url: 'https://shop.example/hook', secret: 's3cret' });
});
