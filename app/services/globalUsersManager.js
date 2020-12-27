const User   = require('../models/User');
const logger = require('./logger');
const async  = require('async');
const mailer = require('./email');
const UserController = require('../controllers/UserController');

var globalUsersManager = {};

globalUsersManager.pushBackRejected = function(adminUser, callback){

    /*
    User.updateMany({
        $and: [
            {
                'status.statusReleased': false
            },
            {
                'status.rejected': true
            }
        ]
    }, {
        $set: {
            'status.rejected': false,
            'applicationAdmit': [],
            'applicationReject': [],
            'applicationVotes': [],
            'numVotes': 0
        },
        $inc: {
            'lastUpdated': 10000000000000
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Unrejected all rejected users without status release', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });*/


    User.find({
        'status.statusReleased': false,
        'status.rejected': true
    }, function(err, users) {

        if (err || !users) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        for (var i = 0; i < users.length; i++) {
            User.findOneAndUpdate(
                {
                    _id : users[i]._id
                }, {
                    $set: {
                        'status.rejected': false,
                        'applicationAdmit': [],
                        'applicationReject': [],
                        'applicationVotes': [],
                        'numVotes': 0
                    },
                    $inc: {
                        'lastUpdated': 10000000000000
                    }
                }, {
                    new: true
                },
                function(e, user) {

                    Settings.findOneAndUpdate({

                    }, {
                        $pull: {
                            'emailQueue.rejected': user.email
                        }
                    }, function (a, b) {
                        logger.logConsoleDebug(`Pushed ${user._id} back.`)
                    })


            })

        }


        logger.logAction(adminUser._id, -1, 'Unrejected all rejected users without status release.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);

    })


}

globalUsersManager.queueLagger = function(adminUser, callback){

    logger.logAction(adminUser._id, -1, 'Queued lagger emails', 'EXECUTOR IP: ' + adminUser.ip);

    User.find({
        'permissions.verified': true,
        'status.confirmed': false,
        'status.statusReleased': true,
        'status.admitted': true,
        'status.declined': false,
        'permissions.checkin': false
    }, function(err, users) {


        logger.logConsoleDebug('laggerconf', users)

        for (var i = 0; i < users.length; i++) {

            //send the email
            mailer.queueEmail(users[i].email, 'laggerconfirmemails', function (err) {
                if (err) {
                    return callback(err);
                }
            });
        }

    });

    User.find({
        'permissions.verified': true,
        'status.admitted': false,
        'status.rejected': false,
        'status.waitlisted': false,
        'status.submittedApplication': false,
        'permissions.checkin': false
    }, function(err, users) {

        logger.logConsoleDebug('laggerapps', users)

        for (var i = 0; i < users.length; i++) {


            //send the email
            mailer.queueEmail(users[i].email, 'laggeremails', function (err) {
                if (err) {
                    return callback(err);
                }
            });
        }

    });


    User.find({
        'permissions.verified': true,
        'status.confirmed': true,
        'status.statusReleased': true,
        'status.admitted': true,
        'status.declined': false,
        'permissions.checkin': false,
        'status.waiver': false
    }, function(err, users) {

        logger.logConsoleDebug('laggerwaiver', users)

        for (var i = 0; i < users.length; i++) {


            //send the email
            mailer.queueEmail(users[i].email, 'laggerwaiveremails', function (err) {
                if (err) {
                    return callback(err);
                }
            });
        }

    });

    return callback(null, 'ok');
}

globalUsersManager.releaseAllStatus = function(adminUser, callback){
    User.updateMany({
        'status.statusReleased': false
    }, {
        $set: {
            'status.statusReleased': true
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Released all user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });
};

globalUsersManager.releaseAllAccepted = function(adminUser, callback){
    User.updateMany({
        'status.statusReleased': false,
        'status.admitted': true
    }, {
        $set: {
            'status.statusReleased': true
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Released all accepted user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });
};

globalUsersManager.releaseAllWaitlisted = function(adminUser, callback){
    User.updateMany({
        'status.statusReleased': false,
        'status.waitlisted': true
    }, {
        $set: {
            'status.statusReleased': true
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Released all waitlisted user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });
};

globalUsersManager.releaseAllRejected = function(adminUser, callback){
    User.updateMany({
        'status.statusReleased': false,
        'status.rejected': true
    }, {
        $set: {
            'status.statusReleased': true
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Released all rejected user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });
};

globalUsersManager.hideAllStatusRelease = function(adminUser, callback){
    User.updateMany({
        'status.statusReleased': true,
        $or : [
            {
                'permissions.reviewer': false
            },
            {
                'permissions.admin': false
            },
            {
                'permissions.owner': false
            },
            {
                'permissions.developer': false
            }
        ]
    }, {
        $set: {
            'status.statusReleased': false
        }
    }, function(err, result){
        if (err || !result) {
            return callback(err ? err : { error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, -1, 'Hid all user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, result.nModified);
    });
};


globalUsersManager.flushAllEmails = function (adminUser, callback) {
    User.find({}, function (err, users) {
        logger.defaultLogger.debug('Users to be flushed.', users, err);

        logger.logAction(adminUser._id, -1, 'Flushed all emails from queue.', 'EXECUTOR IP: ' + adminUser.ip);

        async.each(users, function (user, callback) {
            UserController.flushEmailQueue(adminUser, user._id, (err, msg) => {
                if(err){
                    logger.defaultLogger.error(`Error flushing all emails for user ${user._id}. `, err, msg);
                }
                else{
                    logger.defaultLogger.info(`Flushed email queue for ${user._id} successfully. `, msg);
                }
                return callback()
            });

        }, function () {
            return callback(null, users.length)
        });
    });
};


module.exports = globalUsersManager;
