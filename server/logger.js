import pino from 'pino'
import { join } from 'path';
const logPath = join('app.log');

// const logger = pino({
//   level: 'info',
// //   prettyPrint: true,
//   base: null,
//   timestamp: () => `,"time":"${new Date().toISOString()}"`,
// }, pino.destination(logPath))

const logger = pino({
    level: 'info',
    timestamp: () => `,"time":${new Date().toLocaleString()}`
}, pino.destination(logPath))


const _logger = logger
export { _logger as logger }