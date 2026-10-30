'use strict';

const LEVELS = { debug: 10, info: 20, error: 30, none: 100 };

const write = (level, msg) => {
    const line = `[${new Date().toISOString()}] [myPOS API] [${level.toUpperCase()}] ${msg}`;
    if (level === 'error') {
        console.error(line);
    } else {
        console.log(line);
    }
};

/**
 * A logger bound to one SDK instance's `logLevel`. Levels: debug, info, error,
 * none. Unknown values fall back to info.
 *
 * Debug output includes full request parameters, customer details among them,
 * so it is meant for development only.
 */
const createLogger = (level) => {
    const threshold = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
    const at = (name) => (msg) => {
        if (LEVELS[name] >= threshold) {
            write(name, msg);
        }
    };

    return {
        debug: at('debug'),
        info: at('info'),
        error: at('error'),
    };
};

// The module itself is a logger at the default level, for code that has no
// SDK instance to read a level from.
module.exports = Object.assign(createLogger('info'), { createLogger });
