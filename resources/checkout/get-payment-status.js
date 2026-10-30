'use strict';

const { safeVal } = require('../../utils/common');
const CheckoutApiRequest = require('../abstract/checkout-api-request');

class GetPaymentStatusRequest extends CheckoutApiRequest {
    constructor(mypos, params) {
        const config = mypos.config.checkout;

        super(mypos, {
            IPCmethod: 'IPCGetPaymentStatus',
            IPCVersion: safeVal(params.version, safeVal(config.version, '1.4')),
            IPCLanguage: safeVal(params.lang, safeVal(config.lang, 'EN')),
            SID: safeVal(params.sid, config.sid),
            walletnumber: safeVal(params.walletNumber, config.clientNumber),
            KeyIndex: config.keyIndex,
            OrderID: params.orderId,
            OutputFormat: safeVal(params.outputFormat, safeVal(config.outputFormat, 'JSON'))
        });
    }
}

module.exports = GetPaymentStatusRequest;
