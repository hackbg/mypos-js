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
        return (Math.round(number * 100) / 100).toFixed(2);
    },

    escapeHtml: (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
};
