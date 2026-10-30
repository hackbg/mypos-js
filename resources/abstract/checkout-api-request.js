'use strict';

const { createLogger } = require('../../utils/logger');
const { escapeHtml } = require('../../utils/common');
const signature = require('../../utils/signature');

const HOSTS = {
    sandbox: 'https://www.mypos.com/vmp/checkout-test',
    production: 'https://www.mypos.com/vmp/checkout',
};

/**
 * Base for every Checkout API (IPC) call.
 *
 * A request is an ordered list of fields, signed as a whole. Fields whose value
 * is undefined or null are dropped before signing, so an optional parameter
 * that was not given is omitted rather than sent as the string "undefined".
 *
 * Three ways to use one:
 *   - form():  the signed fields and the URL to POST them to, for rendering a
 *              hosted-checkout handoff yourself (e.g. under a strict CSP).
 *   - post():  send it server-to-server and resolve with myPOS's parsed reply.
 *   - send():  the original API. Writes, or passes to a callback, an HTML page
 *              that auto-submits the form. Kept for compatibility.
 */
class CheckoutApiRequest {
    constructor(mypos, params) {
        this._mypos = mypos;
        this._params = params;
    }

    get mypos() {
        return this._mypos;
    }

    get params() {
        return this._params;
    }

    get logger() {
        return this.mypos.logger || createLogger(this.mypos.config.logLevel);
    }

    get host() {
        return this.mypos.config.isSandbox ? HOSTS.sandbox : HOSTS.production;
    }

    /** [name, value] pairs, stringified, in request order, Signature last. */
    signedFields() {
        const pairs = Object.entries(this.params)
            .filter(([name, value]) => name !== 'Signature' && value !== undefined && value !== null)
            .map(([name, value]) => [name, String(value)]);

        pairs.push(['Signature', signature.sign(pairs, this.mypos.config.checkout.privateKey)]);
        return pairs;
    }

    form() {
        const fields = this.signedFields();
        this.logger.debug(`Prepared myPOS Checkout API request: ${JSON.stringify(fields)}`);
        return { action: this.host, method: 'POST', fields };
    }

    /**
     * Server-to-server call. Resolves with the parsed JSON reply (the request
     * asks for OutputFormat JSON), and rejects on a network error, a timeout, a
     * non-2xx status or a body that is not JSON. A reply with a non-zero
     * `Status` is still resolved: what that means is the caller's decision.
     */
    async post({ timeoutMs = 15000 } = {}) {
        const { action, fields } = this.form();
        const response = await fetch(action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
            body: new URLSearchParams(fields).toString(),
            signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await response.text();

        if (!response.ok) {
            throw new Error(`myPOS ${this.params.IPCmethod} failed with HTTP ${response.status}: ${text.slice(0, 200)}`);
        }

        try {
            const body = JSON.parse(text);
            this.logger.debug(`myPOS ${this.params.IPCmethod} replied: ${text}`);
            return body;
        } catch (err) {
            throw new Error(`myPOS ${this.params.IPCmethod} returned a non-JSON reply: ${text.slice(0, 200)}`);
        }
    }

    send = (handler) => {
        const { action, fields } = this.form();
        const data = generateForm(action, fields);

        if (isFunction(handler)) {
            handler(data);
            return;
        }

        if (typeof handler.setHeader === 'function' && !handler.headersSent) {
            // Without a declared type and charset the page can render as text
            // (under X-Content-Type-Options: nosniff) and non-ASCII names
            // reach myPOS mis-encoded.
            handler.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        handler.write(data);
        handler.end();
    };
}

const generateForm = (host, fields) => {
    let rawHtml = '<html><head><meta charset="utf-8"></head><body onload="document.ipcForm.submit()">';
    rawHtml += `<form id="ipcForm" name="ipcForm" action="${escapeHtml(host)}" method="post" accept-charset="utf-8">`;

    for (const [key, value] of fields) {
        rawHtml += `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}"/><br>`;
    }

    rawHtml += `</form></body></html>`;
    return rawHtml;
};

const isFunction = (functionToCheck) => {
    return typeof functionToCheck === 'function';
};

CheckoutApiRequest.HOSTS = HOSTS;

module.exports = CheckoutApiRequest;
