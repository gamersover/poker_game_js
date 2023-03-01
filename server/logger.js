const pino = require('pino')


// const { join } = require('path');

// const logPath = join(__dirname, 'logs', 'app.log');

// const logger = pino({
//   level: 'info',
// //   prettyPrint: true,
//   base: null,
//   timestamp: () => `,"time":"${new Date().toISOString()}"`,
// }, pino.destination(logPath))

const logger = pino({
    level: 'info',
    timestamp: () => `,"time":${new Date().toLocaleString()}`
})


exports.logger = logger