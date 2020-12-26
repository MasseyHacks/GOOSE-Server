const LogEvent        = require('../models/LogEvent');
const axios           = require('axios');
const winston         = require('winston');
const {LoggingWinston}= require('@google-cloud/logging-winston');
const User            = require('../models/User');

//const Raven           = require('raven');
function createWinstonLogger() {
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
            new winston.transports.File({ filename: 'error.log' , level:'error', handleExceptions: true}),
            new winston.transports.File({ filename: 'combined.log' }),
            loggingWinston
        ]//,
        // exceptionHandlers: [
        //     new winston.transports.File({ filename: 'exceptions.log' }),
        //     loggingWinston
        // ]
    });
    winston.loggers.add('default', logger);
    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    //
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston.transports.Console({
            format: winston.format.simple(),
            handleExceptions: true
        }));
    }
    return logger;
}

async function getLogActor(id) {
    if (id === -1) {
        return {
            _id: -1,
            email: 'internal@masseyhacks.ca',
            name: 'MasseyHacks Internal Authority'
        }
    } else {
        try {
            const doc = await User.findById(id);
            return {
                _id: id.toString(),
                email: doc.email,
                name: doc.fullName
            }
        } catch (e) {
            return null
        }

    }
}

let Logger = {
    defaultLogger: createWinstonLogger(),
    defaultResponse : function(req, res, responseJSON = true){
        return function(err, data){

            if (err){
                // Only send error to slack if in production
                // Keep everyone happy
                console.log('ERROR defaultResponse', err);
                if (process.env.NODE_ENV === 'production'){

                    let data =  'Request: ' + req.method + ' ' + req.url + '\n' +
                        'User: ' + req.userExecute['fullName'] + ' ' + req.userExecute['ip'] + '\n' +
                        '\n -------------------------- \n' +
                        'Body: \n ' +
                        JSON.stringify(req.body, null, 2) +
                        '\n -------------------------- \n' +
                        '\nError:\n' +
                        JSON.stringify(err, null, 2) +
                        '``` \n';
                    this.defaultLogger.error(data.replace('\n', ' '));
                    /*if (process.env.SERVER_RAVEN_KEY && (!err.code || err.code >= 500)) {
                        Raven.captureMessage(data, {
                            level: 'error'
                        })
                    }*/

                    if (process.env.ERROR_SLACK_HOOK) {
                        this.logToConsole('Sending slack notification...');

                        axios.post(process.env.ERROR_SLACK_HOOK,
                            {
                                form: {
                                    payload: JSON.stringify({

                                        'icon_emoji': ':happydoris:',
                                        'username': 'CrashBot',
                                        'text':
                                            'Hey! ' + ((!err.code || err.code >= 500) ? process.env.ADMIN_UIDS : '') + ' An issue was detected with the server.\n\n```' +
                                            data
                                    })
                                }
                            }
                        ).then(() => logger.logToConsole('Message sent to slack'));
                    }
                }

                return res.status(err.code ? err.code : 500).json(err);
            } else {
                if(responseJSON){
                    return res.json(data);
                }
                else{
                    return res.send(data);
                }
            }
        };
    },
    logToConsole: function logToConsole() {
        let finalLog = [];
        for (let i = 0; i < arguments.length; i++) {
            finalLog.push(arguments[i]);
        }
        console.log(...finalLog)
    },
    logAction : async function (actionFrom, actionTo, message, detailedMessage, cb) {
        // Start bash
        // this.defaultLogger.info(`timestamp: ${Date.now()}, idTo: ${actionTo}, idFrom: ${actionFrom}, message: ${message}, detailedMessage: ${detailedMessage}`);
        let fromData = getLogActor(actionFrom);
        let toData = getLogActor(actionTo);
        fromData = await fromData;
        toData = await toData;
        if (!fromData || !toData) {
            if (cb) {
                return cb("Logging failed")
            }
            if (!fromData) {
                fromData = {
                    email: 'Not found',
                    error: `User ${actionFrom} not found`
                }
            }
            if (!toData) {
                toData = {
                    email: 'Not found',
                    error: `User ${actionFrom} not found`
                }
            }
        }
        this.defaultLogger.debug("fromData: " + JSON.stringify(fromData));
        this.defaultLogger.debug("toData: " + JSON.stringify(toData));

        this.defaultLogger.info(`From: ${fromData['email']}, To: ${toData['email']}, message: ${message}`, {
            details: {
                from: fromData,
                to: toData,
                message: message,
                detailedMessage: detailedMessage,
                time: Date.now()
            }
        });

        if (cb) {
            cb()
        }


        if(process.env.NODE_ENV === 'development'){
            LogEvent
                .create({
                    'to.ID': actionTo,
                    'from.ID': actionFrom,
                    'message': message,
                    'detailedMessage': detailedMessage,
                    'timestamp': Date.now()
                }, function (err, e) {

                    LogEvent
                        .findOne({_id: e._id})
                        .populate(actionFrom === -1 ? '' : 'fromUser') // Only populate if user exists
                        .populate(actionTo === -1 ? '' : 'toUser')
                        .exec(function (err, event) {

                            Logger.logToConsole(event);

                            if (event) {
                                LogEvent.findOneAndUpdate({
                                    _id: event._id
                                }, {
                                    'from.name': actionFrom === -1 ? 'MasseyHacks Internal Authority' : event.fromUser !== null ? event.fromUser.fullName : 'Unable to get name',
                                    'from.email': actionFrom === -1 ? 'internal@masseyhacks.ca' : event.fromUser !== null ? event.fromUser.email : 'Unable to get name',
                                    'to.name': actionTo === -1 ? 'MasseyHacks Internal Authority' : event.toUser !== null ? event.toUser.fullName : 'Unable to get name',
                                    'to.email': actionTo === -1 ? 'internal@masseyhacks.ca' : event.toUser !== null ? event.toUser.email : 'Unable to get email'
                                }, {
                                    new: true
                                }, function (err, newEvent) {

                                    Logger.logToConsole(newEvent);

                                    if (cb) {
                                        cb();
                                    }
                                })
                            } else {
                                Logger.logToConsole('Logging fail.')
                            }
                        });

                })
        }

    },

    test: () => '123'
};

module.exports = Logger;