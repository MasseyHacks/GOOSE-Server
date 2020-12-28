require('dotenv').config();

const Settings = require('./Settings');

const logger = require('../services/logger');
const mailer = require('../services/email');

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const fields = require('./data/UserFields');
//const Raven = require('raven');
const async = require('async');

JWT_SECRET = process.env.JWT_SECRET;

var schema = new mongoose.Schema(fields);

schema.methods.checkPassword = function (password) {
    return bcrypt.compareSync(password, this.password);
};

schema.methods.generateAuthToken = function () {
    return jwt.sign({
        id: this._id,
        type: 'authentication',
    }, JWT_SECRET, {
        expiresIn: 1209600
    });
};

schema.methods.generateVerificationToken = function () {
    return jwt.sign({id: this._id, type: 'verification'}, JWT_SECRET, {
        expiresIn: 3600
    });
};

schema.methods.generateMagicToken = function () {
    return jwt.sign({id: this._id, type: 'magicJWT'}, JWT_SECRET, {
        expiresIn: 600
    });
};

schema.methods.generateResetToken = function () {
    return jwt.sign({id: this._id, type: 'password-reset'}, JWT_SECRET, {
        expiresIn: 3600
    });
};

schema.methods.setPermission = function (level) {
    const logger = require('../services/logger');
    logger.defaultLogger.debug('Got level ', level);

    if (level && typeof level == 'string') {
        for (var key in fields['permissions']) {

            if (key == level.toLowerCase()) {

                logger.defaultLogger.debug('Locked to', key);

                level = fields['permissions'][key]['permissionLevel'];
                break
            }
        }
    }

    logger.defaultLogger.debug('Translating to ', level);

    if (!level) {
        level = 0
    }

    for (var key in fields.permissions) {
        this.permissions[key] = fields['permissions'][key]['permissionLevel'] <= level
    }

    this.update({
        permissions: this.permissions
    }, function (err, user) {
        if (err || !user) {
            logger.defaultLogger.debug('Failed to set permission')
        }

        logger.defaultLogger.debug('Permission set')
    });
};

schema.set('toJSON', {
    virtuals: true
});

schema.set('toObject', {
    virtuals: true
});

schema.statics.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

schema.statics.resetAdmissionState = function (adminUser, userID, callback) {
    const logger = require('../services/logger');
    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments'});
    }

    module.exports.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true
    }, {
        $set: {
            'status.admitted': false,
            'status.rejected': false,
            'status.waitlisted': false,
            'statusReleased': false,
            'applicationAdmit': [],
            'applicationReject': [],
            'applicationVotes': [],
            'status.admittedBy': '',
            'numVotes': 0
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        Settings.findOneAndUpdate({}, {
            $pull: {
                'emailQueue.acceptanceEmails': user.email,
                'emailQueue.rejectionEmails': user.email,
                'emailQueue.waitlistEmails': user.email,
                'emailQueue.laggerEmails': user.email,
                'emailQueue.laggerConfirmEmails': user.email,
                'emailQueue.laggerWaiverEmails': user.email
            }
        }, function (err, settings) {
            if (err || !settings) {
                return callback(err ? err : {error: 'Unable to perform action.', code: 400})
            }


            logger.logAction(adminUser._id, user._id, 'Reset admission status.', 'EXECUTOR IP: ' + adminUser.ip);

            return callback(err, user);

        });

    });
}

schema.statics.admitUser = function (adminUser, userID, callback) {
    const logger = require('../services/logger');
    logger.defaultLogger.debug('Trying to admit', userID);

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments'});
    }

    Settings.findOne({}, function (err, settings) {
        module.exports.findOneAndUpdate({
            _id: userID,
            'permissions.verified': true,
            'status.rejected': false,
            'status.admitted': false,
            'status.waitlisted': false
        }, {
            $set: {
                'status.admitted': true,
                'status.rejected': false,
                'status.waitlisted': false,
                'statusReleased': false,
                'status.admittedBy': adminUser.email,
                'status.confirmBy': Date.now() > settings.timeConfirm ? Date.now() + 604800000 : settings.timeConfirm
            }
        }, {
            new: true
        }, function (err, user) {

            logger.defaultLogger.debug('Returned user:', user)

            if (err || !user) {
                return callback(err ? err : {error: 'Unable to perform action.', code: 400})
            }

            logger.logAction(adminUser._id, user._id, 'Admitted user.', 'EXECUTOR IP: ' + adminUser.ip);

            //send the email
            mailer.queueEmail(user.email, 'acceptanceemails', function (err) {
                if (err) {
                    return callback(err);
                }
            });

            return callback(err, user);

        });
    });
};

schema.statics.rejectUser = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments'});
    }

    module.exports.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': false,
        'status.waitlisted': false
    }, {
        $set: {
            'status.admitted': false,
            'status.rejected': true,
            'status.waitlisted': false,
            'statusReleased': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Rejected user.', 'EXECUTOR IP: ' + adminUser.ip);

        mailer.queueEmail(user.email, 'rejectionemails', function (err) {
            if (err) {
                return callback(err);
            }
        });

        return callback(err, user);

    });
};

schema.statics.getByID = function (id, callback, permissionLevel, bypass) {
    /*
    if (permissionLevel == null) {
        permissionLevel = 1;
    }*/

    this.findOne({
        _id: id
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {
                error: 'User not found.',
                code: 404
            })

        }

        if (bypass) {
            return callback(null, user);
        }

        return callback(null, filterSensitive(user, permissionLevel));
    });
};

schema.statics.getByToken = function (token, callback) {
    jwt.verify(token, JWT_SECRET, function (err, payload) {
        if (err || !payload) {
            return callback({
                error: 'Invalid Token',
                code: 401
            });
        }

        if (payload.type != 'authentication' || !payload.exp || Date.now() >= payload.exp * 1000) {
            return callback({
                error: ' Invalid Token',
                code: 403
            });
        }

        this.findOne({_id: payload.id}, function (err, user) {

            if (err || !user) {
                return callback(err ? err : {
                    error: 'Invalid Token',
                    code: 401
                });
            }

            if (payload.iat * 1000 < user.passwordLastUpdated) {
                return callback({
                    error: 'Invalid Token',
                    code: 401
                });
            }
            return callback(err, user);
        });


    }.bind(this));
};

schema.statics.getUser = async function (query) {
    return await this.findOne(query);
};

schema.statics.getByEmail = function (email, callback, permissionLevel) {
    this.findOne({
        email: email ? email.toLowerCase() : email
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {
                error: 'User not found',
                code: 404
            })
        }
        return callback(null, user); //filterSensitive(user, permissionLevel));
    });
};

schema.statics.validateProfile = function (profile, callback) {
    const logger = require('../services/logger');
    logger.defaultLogger.debug('Validating profile!');
    try {
        var queue = [[fields.profile, profile]];
        var runner;
        var userpath;
        var keys;

        while (queue.length !== 0) {
            runner = queue[0][0];
            userpath = queue.shift()[1];
            keys = Object.keys(runner);

            for (var i = 0; i < keys.length; i++) {
                if ('type' in runner[keys[i]]) {
                    if (profile.signature !== -1 && runner[keys[i]].mandatory && !userpath[keys[i]]) {
                        return callback({error: 'Field "' + keys[i] + '" is required'})
                    }

                    if (runner[keys[i]].maxlength && userpath[keys[i]] && userpath[keys[i]].length > runner[keys[i]].maxlength) {
                        return callback({error: 'Field "' + keys[i] + '" exceeds character limit'})
                    }

                    if (runner[keys[i]]['questionType'] && ['dropdown', 'multiradio'].indexOf(runner[keys[i]]['questionType']) != -1) {
                        if (runner[keys[i]]['enum']['values'].split('|').indexOf(userpath[keys[i]]) == -1 && (userpath[keys[i]] || runner[keys[i]].mandatory) && !(profile.signature === -1 && !userpath[keys[i]])) {
                            return callback({error: 'Field "' + keys[i] + '" with value "' + userpath[keys[i]] + '" is invalid'})
                        }
                    }

                    if (runner[keys[i]]['questionType'] && runner[keys[i]]['questionType'] == 'multicheck' && ((userpath[keys[i]] && userpath[keys[i]].length > 0) || runner[keys[i]].mandatory)) {
                        for (var r in userpath[keys[i]]) {
                            if (runner[keys[i]]['enum']['values'].split('|').indexOf(userpath[keys[i]][r]) == -1 && !(profile.signature === -1 && !userpath[keys[i]][r])) {
                                return callback({error: 'Field "' + keys[i] + '" with value "' + userpath[keys[i]][r] + '"is invalid'})
                            }
                        }
                    }

                    if (profile.signature !== -1 && runner[keys[i]]['questionType'] && runner[keys[i]]['questionType'] == 'birthday') {
                        var birthdayValues = userpath[keys[i]].split("/");
                        var birthdayDate = new Date();
                        birthdayDate.setFullYear(parseInt(birthdayValues[0]), parseInt(birthdayValues[1]) - 1, parseInt(birthdayValues[2]));
                        if (birthdayValues.length != 3 || userpath[keys[i]].length != runner[keys[i]].maxlength) {
                            return callback({error: 'Birthday given in incorrect format'})
                        }
                        else if((birthdayDate.getFullYear() != parseInt(birthdayValues[0])) || (birthdayDate.getMonth() != parseInt(birthdayValues[1]) - 1) || (birthdayDate.getDate() != parseInt(birthdayValues[2]))){
                            return callback({error: 'Invalid birthday'})
                        }
                        else if((new Date()).getFullYear() - birthdayDate.getFullYear() > 130){
                            return callback({error: 'User claims they are over 130 years old'})
                        }
                    }

                    if (profile.signature !== -1 && runner[keys[i]]['questionType'] && runner[keys[i]]['questionType'] == 'phoneNumber') {
                        var phoneNumber = userpath[keys[i]];
                        if(phoneNumber.length > runner[keys[i]].maxlength){
                            return callback({error: 'Phone number is too long'})
                        } else if(isNaN(phoneNumber)) {
                            return callback({error: 'Phone number is not a number'})
                        }

                    }

                    if (profile.signature !== -1 && runner[keys[i]]['questionType'] && runner[keys[i]]['questionType'] == 'contract') {
                        if (!userpath[keys[i]]) {
                            return callback({error: 'Contract field "' + keys[i] + '" must be agreed to'})
                        }
                    }
                } else {
                    if (userpath[keys[i]]) {
                        queue.push([runner[keys[i]], userpath[keys[i]]])
                    }
                }
            }
        }
        const logger = require('../services/logger');

        logger.defaultLogger.debug('Profile accepted!')

        return callback(null, profile);
    } catch (e) {

        const logger = require('../services/logger');
        logger.defaultLogger.error('Error while validating user profile. ', e)

        return callback({ error: 'You broke something...' })

    }
};

schema.statics.addPoints = function(adminUser, id, amount, notes, callback){
    this.findOneAndUpdate(
        {
            _id: id
        },
        {
            $push: {
                'points.history': {
                    amount: amount,
                    awardedBy: adminUser._id,
                    notes: notes
                }
            }
        },
        {
            new: true
        },
        function(err, user){
            if(err){
                return callback(err);
            }

            return callback(null, "Added points to user successfully.");
        });
}

schema.virtual('lowerCaseName').get(function () {
    if (this.firstName && this.lastName) {
        return this.firstName.toLowerCase() + ' ' + this.lastName.toLowerCase();
    }

    return '';
});

schema.virtual('fullName').get(function () {
    if (this.firstName && this.lastName) {
        return this.firstName + ' ' + this.lastName;
    }

    return '';
});

schema.virtual('permissions.level').get(function () {
    // 0 - Hacker Unverified
    // 1 - Hacker
    // 2 - Check In
    // 3 - Admin
    // 4 - Review
    // 5 - Owner
    // 6 - Developer

    if (!this.status.active || this.status.passwordSuspension) {
        return 0;
    } else if (this.permissions.developer) { // Developers (Gods)
        return 6;
    } else if (this.permissions.owner) { // Owner
        return 5;
    } else if (this.permissions.reviewer) { // Admin w/ review
        return 4;
    } else if (this.permissions.admin) { // Admin w/o review
        return 3;
    } else if (this.permissions.checkin) { // Checkin
        return 2;
    } else if (this.permissions.verified) { // Verified
        return 1;
    } else { // Unverified
        return 0;
    }
});

schema.virtual('userType.name').get(function () {
    if (this.permissions.developer) {
        return 'Developer';
    } else if (this.permissions.owner) {
        return 'Owner';
    } else if (this.permissions.admin) {
        return 'Admin';
    }

    var type = [];

    if (this.permissions.checkin) {
        type.push('Check In');
    }

    if (this.userType.hacker) {
        type.push('Hacker');
    }

    if (this.userType.mentor) {
        type.push('Mentor');
    }

    if (this.userType.workshopHost) {
        type.push('Workshop Host');
    }

    return type.length ? type.join(' and ') : 'Goose';
});

schema.virtual('status.name').get(function () {

    if (this.permissions.level >= 2) {
        return 'organizer';
    }

    if (this.status.checkedIn && this.status.statusReleased) {
        return 'checked in';
    }

    if (this.status.declined && this.status.statusReleased) {
        return 'declined';
    }

    if (this.status.waitlisted && this.status.statusReleased) {
        return 'waitlisted';
    }

    if (this.status.confirmed && this.status.statusReleased) {
        return 'confirmed';
    }

    if (this.status.admitted && this.status.statusReleased) {
        return 'admitted';
    }

    if (this.status.rejected && this.status.statusReleased) {
        return 'rejected';
    }

    if (this.status.submittedApplication) {
        return 'submitted';
    }

    if (!this.permissions.verified) {
        return 'unverified';
    }

    return 'incomplete';

});

schema.virtual('profile.isSigned').get(function () {
    return this.profile.signature !== -1;
});

schema.virtual('points.total').get(function() {
    let acc = 0;
    for (let pointInfo of this.points.history){
        acc += pointInfo.amount;
    }
});

schema.statics.filterSensitive = function (user, permission, page) {
    return filterSensitive(user, permission, page);
};

var filterSensitive = function (user, permission, page) {

    try {
        const logger = require('../services/logger');
        logger.defaultLogger.debug(page);
        if (page === 'checkin') {
            return {
                id: user.id,
                name: user.fullName,
                waiver: user.status.waiver,
                checked: user.status.checkedIn,
                email: user.email,
                school: user.profile.hacker.school,
                grade: user.profile.hacker.grade
            }
        }

        var u = user.toJSON();

        var permissionLevel;

        if (permission) {
            permissionLevel = permission;
        } else {
            permissionLevel = 0;
        }

        var queue = [[fields, u]];
        var runner;
        var userpath;
        var keys;

        logger.defaultLogger.debug('Permission level:', permissionLevel)

        while (queue.length !== 0) {
            runner = queue[0][0];
            userpath = queue.shift()[1];
            keys = Object.keys(runner);

            for (var i = 0; i < keys.length; i++) {
                if ('type' in runner[keys[i]]) {
                   if (runner[keys[i]].permission && runner[keys[i]].permission > permissionLevel) {
                        try {
                            delete userpath[keys[i]];
                        } catch (e) {
                            logger.defaultLogger.error(e)
                        }
                    }
                    if (permissionLevel < 2 && runner[keys[i]].condition && !navigate(user, runner[keys[i]].condition)) {
                        userpath[keys[i]] = runner[keys[i]].default;
                        // console.log(keys[i])
                    }

                } else {
                  if (userpath[keys[i]]) {
                        queue.push([runner[keys[i]], userpath[keys[i]]])
                   }
               }
            }
        }

        return u;
    } catch (e) {
        //Raven.captureException(e);
        const logger = require('../services/logger');
        logger.defaultLogger.error(e);
        return {};
    }
};

var navigate = function (dictionary, path) {
    var runner = dictionary;
    path = path.split('.');

    for (var i = 0; i < path.length - 1; i++) {
        runner = runner[path[i]];
    }

    return runner[path[path.length - 1]];
};

module.exports = mongoose.model('User', schema);