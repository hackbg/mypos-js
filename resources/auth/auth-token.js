'use strict';

const util = require('util');

class AuthToken {
    constructor(data) {
        this._token = data.access_token;
        this._type = data.token_type;
        this._expiresIn = data.expires_in;
        this._error = data.error;
        this._issuedAt = nowSeconds();
    }

    get token() {
        return this._token;
    }

    get type() {
        return this._type;
    }

    get expiresIn() {
        return parseInt(this._expiresIn);
    }

    get expiresAt() {
        return this._issuedAt + this.expiresIn;
    }

    get error() {
        return this._error;
    }

    get forHeader() {
        return `${this.type} ${this.token}`;
    }

    get isExpired() {
        // A token without a usable lifetime counts as expired, so it is
        // replaced rather than reused forever (NaN never compares as later).
        if (!Number.isFinite(this.expiresAt)) {
            return true;
        }
        // A minute early, so a token is not sent in the instant it lapses.
        return nowSeconds() > this.expiresAt - 60;
    }

    get asJSON() {
        return {
            token: this.token,
            type: this.type,
            expiresIn: this.expiresIn,
            expiresAt: this.expiresAt,
            isExpired: this.isExpired,
            error: this.error
        };
    }
}

// Read on every call. This was a module-level constant, fixed at load time,
// so a token never expired for as long as the process ran.
const nowSeconds = () => Math.floor(Date.now() / 1000);

module.exports = AuthToken;