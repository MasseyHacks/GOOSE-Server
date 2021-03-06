require('dotenv').config();
const express = require('express');

const app = express();
const cors = require('cors');

const mongoose        = require('mongoose');
const port            = process.env.PORT || 3005;
const database        = process.env.DATABASE || 'mongodb://localhost:27017/goose';
const logger          = require('./app/services/logger');

// Start configuration
const organizers      = require('./config/organizers');
const settings        = require('./config/settings');

// Start services
const stats           = require('./app/services/stats');

const Waiver          = require('./app/models/GridStore');

mongoose.connect(database,
    {
        auto_reconnect: true,
        useNewUrlParser: true,
        useFindAndModify: false,
        useCreateIndex: true
    }).then(() => {
        Waiver.init(mongoose.connection.db)
    })
    .catch(error => {
        // logger.logToConsole("DB CONNECTION ERROR");
        logger.defaultLogger.error(error);
        // logger.logToConsole(error)
    });

stats.startService();

// const requestLogger = winston.createLogger({
//     format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
//     transports: [
//         new lw.LoggingWinston()
//     ]
// })
//
// function logRequests(req, res, next) {
//     requestLogger.verbose(`${req.url} endpoint hit`, {
//         httpRequest: {
//             status: res.statusCode,
//             requestUrl: req.url,
//             requestMethod: req.method,
//             remoteIp: req.connection.remoteAddress,
//             // etc.
//         }
//     });
//     next()
// }

app.use(cors());
// app.use(logRequests);

let githubRouter = express.Router();
require('./app/routes/github')(githubRouter);
app.use('/github', githubRouter);

var apiRouter = express.Router();
require('./app/routes/api')(apiRouter);
app.use('/api', apiRouter);

var authRouter = express.Router();
require('./app/routes/auth')(authRouter);
app.use('/auth', authRouter);

const paymentRouter = express.Router();
require('./app/routes/payment')(paymentRouter);
app.use('/payment', paymentRouter);

app.listen(port, () => {
    // logger.logToConsole(`listening on port ${port}`);
    logger.defaultLogger.info(`Listening on port ${port}`)
});