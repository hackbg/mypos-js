'use strict';

const crypto = require('crypto');

/**
 * The string myPOS signs: every value in order, joined with "-", then base64
 * encoded. The Signature field itself is never part of it.
 */
const signedPayload = (pairs) => {
    const values = pairs
        .filter(([name]) => name !== 'Signature')
        .map(([, value]) => String(value));
    return Buffer.from(values.join('-'), 'utf8').toString('base64');
};

/** RSA-SHA256 (PKCS#1 v1.5) with the merchant's private key, base64 encoded. */
const sign = (pairs, privateKey) =>
    crypto.sign('sha256', Buffer.from(signedPayload(pairs)), privateKey).toString('base64');

/**
 * Check a signature myPOS sent us (IPCPurchaseNotify, IPCPurchaseOK, and the
 * responses to server-to-server calls) against the myPOS public certificate
 * from the store's configuration pack.
 *
 * `data` is an object or an array of [name, value] pairs, in the order myPOS
 * sent them. A parsed form body keeps that order. Returns false rather than
 * throwing on anything malformed.
 */
const verify = (data, publicCertificate) => {
    try {
        const pairs = Array.isArray(data) ? data : Object.entries(data || {});
        const signature = (pairs.find(([name]) => name === 'Signature') || [])[1];
        if (!signature || !publicCertificate) {
            return false;
        }
        return crypto.verify(
            'sha256',
            Buffer.from(signedPayload(pairs)),
            crypto.createPublicKey(publicCertificate),
            Buffer.from(String(signature), 'base64')
        );
    } catch (err) {
        return false;
    }
};

module.exports = { signedPayload, sign, verify };
