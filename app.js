require('dotenv').config();
const express = require('express');

const app = express();
const cors = require('cors');

const mongoose        = require('mongoose');
const port            = process.env.PORT || 3005;
const database        = process.env.DATABASE || 'mongodb://localhost:27017/goose';
const winston         = require('winston');
const {LoggingWinston}= require('@google-cloud/logging-winston');
const fs              = require('fs');

// Start configuration
const organizers      = require('./config/organizers');
const settings        = require('./config/settings');

// Start services
const stats           = require('./app/services/stats');

const Waiver          = require('./app/models/GridStore');


const levels = {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
};
const loggingWinston = new LoggingWinston();
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    defaultMeta: { service: 'user-service' },
    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new winston.transports.Stream({
            stream: fs.createWriteStream('combined.log')
        }),
        new winston.transports.Stream({
            stream: fs.createWriteStream('error.log'),
            level: 'error'
        }),
        new winston.transports.File({ filename: 'combined.log' }),
        loggingWinston
    ],
    exceptionHandlers: [
        new winston.transports.Stream({
            stream: fs.createWriteStream('exceptions.log')
        }),
        loggingWinston
    ]
});
winston.loggers.add('default', logger)
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

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
        // console.log("DB CONNECTION ERROR");
        logger.error(error);
        // console.log(error)
    });

stats.startService();

app.use(cors());

let githubRouter = express.Router();
require('./app/routes/github')(githubRouter);
app.use('/github', githubRouter);

var apiRouter = express.Router();
require('./app/routes/api')(apiRouter);
app.use('/api', apiRouter);

var authRouter = express.Router();
require('./app/routes/auth')(authRouter);
app.use('/auth', authRouter);

app.listen(port, () => {
    // console.log(`listening on port ${port}`);
    logger.info(`listening on port ${port}`)
});