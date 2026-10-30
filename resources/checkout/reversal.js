'use strict';

const { randomUUID } = require('crypto');
const { safeVal } = require('../../utils/common');
const CheckoutApiRequest = require('../abstract/checkout-api-request');

class CheckoutReversalRequest extends CheckoutApiRequest {
    constructor(mypos, params) {
        const config = mypos.config.checkout;

        super(mypos, {
            IPCmethod: 'IPCReversal',
            IPCVersion: safeVal(params.version, safeVal(config.version, '1.4')),
            IPCLanguage: safeVal(params.lang, safeVal(config.lang, 'EN')),
            SID: safeVal(params.sid, config.sid),
            walletnumber: safeVal(params.walletNumber, config.clientNumber),
            KeyIndex: config.keyIndex,
            IPC_Trnref: params.trnRef,
            OrderID: safeVal(params.orderId, randomUUID()),
            OutputFormat: safeVal(params.outputFormat, safeVal(config.outputFormat, 'JSON'))
        });
    }
}

module.exports = CheckoutReversalRequest;
