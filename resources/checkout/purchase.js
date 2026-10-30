'use strict';

const { randomUUID } = require('crypto');
const { safeVal, money } = require('../../utils/common');
const CheckoutApiRequest = require('../abstract/checkout-api-request');

class CheckoutPurchaseRequest extends CheckoutApiRequest {
    constructor(mypos, params) {
        const config = mypos.config.checkout;
        const customer = params.customer || {};
        const cartItems = params.cartItems || [];
        const currency = safeVal(params.currency, config.currency);

        const purchaseParams = {
            IPCmethod: 'IPCPurchase',
            IPCVersion: safeVal(params.version, safeVal(config.version, '1.4')),
            IPCLanguage: safeVal(params.lang, safeVal(config.lang, 'EN')),
            SID: safeVal(params.sid, config.sid),
            walletnumber: safeVal(params.walletNumber, config.clientNumber),
            Amount: money(params.amount),
            Currency: currency,
            OrderID: safeVal(params.orderId, randomUUID()),
            URL_OK: safeVal(params.okUrl, config.okUrl),
            URL_Cancel: safeVal(params.cancelUrl, config.cancelUrl),
            URL_Notify: safeVal(params.notifyUrl, config.notifyUrl),
            CardTokenRequest: safeVal(params.cardTokenRequest, safeVal(config.cardTokenRequest, 0)),
            KeyIndex: config.keyIndex,
            PaymentParametersRequired: safeVal(params.paymentParametersRequired, safeVal(config.paymentParametersRequired, 1)),
            PaymentMethod: safeVal(params.paymentMethod, safeVal(config.paymentMethod, 1)),
            customeremail: customer.email,
            customerfirstnames: customer.firstNames,
            customerfamilyname: customer.familyName,
            customerphone: customer.phone,
            customercountry: customer.country,
            customercity: customer.city,
            customerzipcode: customer.zipCode,
            customeraddress: customer.address,
            Note: params.note,
            CartItems: cartItems.length
        };

        for (let i = 0; i < cartItems.length; i++) {
            const num = i + 1;
            const item = cartItems[i];
            purchaseParams[`Article_${num}`] = item.name;
            purchaseParams[`Quantity_${num}`] = item.quantity;
            purchaseParams[`Price_${num}`] = money(item.price);
            purchaseParams[`Currency_${num}`] = currency;
            // In cents, so 3 x 19.99 is 59.97 and not 59.97000000000001.
            purchaseParams[`Amount_${num}`] = money(Math.round(item.price * 100) * item.quantity / 100);
        }

        super(mypos, purchaseParams);
    }
}

module.exports = CheckoutPurchaseRequest;
