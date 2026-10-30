'use strict';

module.exports = {
    safeVal: (val, safe) => {
        return (val === undefined || val === null || val.length === 0) ? safe : val;
    },

    /**
     * Money as myPOS expects it: a fixed two-decimal string. Avoids sending
     * float artefacts such as 59.97000000000001 for 3 x 19.99.
     */
    money: (value) => {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            throw new Error(`myPOS: invalid amount ${JSON.stringify(value)}`);
        }
        // Round the cents as decimals, not as the binary float: 1.005 * 100 is
        // 100.49999999999999, which Math.round takes to 1.00 instead of 1.01.
        // Halves round away from zero, so a discount rounds like its price.
        const cents = Math.round(Number((Math.abs(number) * 100).toPrecision(15)));
        return (Math.sign(number) * cents / 100).toFixed(2);
    },

    escapeHtml: (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
};
