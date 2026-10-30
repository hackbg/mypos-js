'use strict';

const request = require('@cypress/request');
const { randomUUID } = require('crypto');
const AuthToken = require('../auth/auth-token');

class ApiRequest {
    constructor(mypos, method, path, params = undefined, data = undefined, isGenerateToken = false) {
        this._mypos = mypos;
        this._method = method;
        this._path = path;
        this._params = params;
        this._reqData = data;
        this._isGenerateToken = isGenerateToken;
    }

    get mypos() {
        return this._mypos;
    }

    get method() {
        return this._method;
    }

    get service() {
        return {};
    }

    get basePath() {
        return `${this.service.host}${this.service.basePath}`;
    }

    get path() {
        return this._path;
    }

    get params() {
        return this._params;
    }

    get reqData() {
        return this._reqData;
    }

    get isGenerateToken() {
        return this._isGenerateToken;
    }

    get url() {
        return `${this.basePath}/${this.path}`;
    }

    get logger() {
        return this.mypos.logger;
    }

    get apiKey() {
        return this.mypos.config.apiKey;
    }

    get tokenGenerationHeaders() {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.mypos.config.apiKey}:${this.mypos.config.apiSecret}`).toString('base64')}`
        }
    }

    get defaultHeaders() {
        return {
            'Authorization': this.mypos.token.forHeader,
            'Accept': 'application/json',
            'API-Key': this.apiKey,
            'Content-Type': 'application/json',
            'X-Request-ID': randomUUID(),
        }
    }

    get options() {
        const options = {
            url: this.url,
            method: this.method,
            headers: this.isGenerateToken ? this.tokenGenerationHeaders : this.defaultHeaders
        };

        if (this.method === 'GET' && this.params !== undefined) {
            options.qs = this.params
        }

        if (this.reqData !== undefined) {
            options.form = this.reqData;
        }

        return options;
    }

    reqIsValid = (callback) => {
        return true;
    };

    send = (callback) => {
        if (!this.reqIsValid(callback)) {
            return;
        }

        const sendReq = () => {
            // Headers are left out: they carry the bearer token or the API secret.
            const { headers, ...loggable } = this.options;
            this.logger.debug(`Sending HTTP request with options: ${JSON.stringify(loggable)}`);

            request(this.options, (err, res, body) => {
                if (err !== undefined && err !== null) {
                    this.logger.error(err);
                    callback(err);
                }
                else {
                    try {
                        let jsonData = JSON.parse(body);
                        callback(jsonData);
                    } catch {
                        callback(body);
                    }
                }
            });
        };

        if (!this.isGenerateToken) {
            // Never the token itself: it is a bearer credential.
            this.logger.debug(`oAuth token ${this.mypos.token === undefined ? 'absent' : 'present'}`);

            if (this.mypos.token === undefined || this.mypos.token.isExpired) {
                generateAuthToken(this.mypos, () => {
                    if (this.mypos.token.error !== undefined) {
                        this.logger.error(`Could not generate token. ${this.mypos.token.error}`);
                        this.mypos.setToken(undefined);
                        callback(null);
                    }
                    else {
                        sendReq();
                    }
                });
            }
            else {
                sendReq();
            }
        }
        else {
            sendReq();
        }
    };
}

class AuthApiRequest extends ApiRequest {

    get service() {
        return {
            host: this.mypos.config.isSandbox ? 'https://sandbox-auth-api.mypos.com' : 'https://auth-api.mypos.com',
            basePath: '/oauth'
        };
    }
}

class GenerateTokenRequest extends AuthApiRequest {
    constructor(mypos) {
        super(mypos,
            'POST',
            'token',
            undefined,
            {
                grant_type: 'client_credentials',
                scope: 'webhooks'
            },
            true
        );
    }
}

const generateAuthToken = (mypos, callback) => {
    let request = new GenerateTokenRequest(mypos);
    request.send((data) => {
        // send() has already parsed a JSON body, so this is usually an object.
        // Parsing it a second time threw, and no token was ever stored.
        let parsed = data;
        if (typeof data === 'string') {
            try {
                parsed = JSON.parse(data);
            } catch (err) {
                parsed = { error: data };
            }
        }
        mypos.setToken(new AuthToken(parsed || { error: 'No response' }));
        callback();
    });
};

module.exports = ApiRequest;
