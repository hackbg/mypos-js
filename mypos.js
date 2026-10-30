'use strict';

const { createLogger } = require('./utils/logger');

const defaultConfig = {
    logLevel: 'info',
    isSandbox: false
};

function MyPOS(config) {
    if (!(this instanceof MyPOS)) {
        return new MyPOS(config);
    }

    this.token = undefined;
    // A fresh object per instance. Assigning into defaultConfig itself made
    // every instance share, and overwrite, the first one's settings.
    this.config = Object.assign({}, defaultConfig, config);
    this.logger = createLogger(this.config.logLevel);

    this.setToken = (token) => {
        this.token = token;
    };

    require('./resources')(this);
    return this;
}

module.exports = MyPOS;
