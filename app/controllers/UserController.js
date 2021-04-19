const User = require('../models/User');
const Settings = require('../models/Settings');
const SettingsController = require('./SettingsController');
const TeamController = require('./TeamController');
const Order = require("../models/ShopOrder");

const jwt = require('jsonwebtoken');
const axios = require('axios');
const async = require('async');

const validator = require('validator');
const moment = require('moment');

const logger = require('../services/logger');
const mailer = require('../services/email');
const flush = require('../services/flush');

const UserFields = require('../models/data/UserFields');
const FilterFields = require('../models/data/FilterFields');

const cpuCount = require('os').cpus().length;

var UserController = {};

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

UserController.addPoints = function (adminUser, id, amount, notes, callback) {
    if(!adminUser || !id || amount === null || isNaN(amount) || (amount * 10)%10 !== 0 || !notes){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }
    User.addPoints(adminUser, id, amount, notes, function(err, msg) {
        if(err){
            logger.defaultLogger.error(`Error adding points to user ${id}. `, err);
            return callback(err);
        }
        logger.logAction(adminUser._id, id, "Added points to user.", `${amount} points. Notes: ${notes}`);
        return callback(err, "Added points to user.");
    });
};

UserController.getOrders = function(userExecute, userID, callback){
    if(!userExecute || !userID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    if(userExecute._id.toString() !== userID && !userExecute.permissions.admin){
        return callback({error: "You cannot fetch orders for that user.", code: 401, clean: true});
    }

    Order.find({
        purchaseUser: userID
    }, function(err, orders){
        if(err){
            return callback(`Error fetching order for user ${userID}. `, err);
        }

        return callback(null, {
            orders: orders
        })
    })
}

UserController.rejectNoState = function (adminUser, callback) {
    if(!adminUser){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.find({
        'status.submittedApplication': true,
        'permissions.checkin': false,
        'permissions.verified': true,
        'status.admitted': false,
        'status.rejected': false,
        'status.waitlisted': false
    }, function (err, users) {
        logger.defaultLogger.debug('Users to be rejected', users, err);

        logger.logAction(adminUser._id, -1, 'Rejected everyone without state.', 'EXECUTOR IP: ' + adminUser.ip);

        async.each(users, function (user, callback) {
            UserController.rejectUser(adminUser, user._id, (err, msg) => {
                logger.defaultLogger.debug(user.fullName, err, msg ? 'Success' : 'Fail');

                return callback()
            })
        }, function () {
            return callback(null, users.length)
        });
    });
};

UserController.modifyUser = function (adminUser, userID, data, callback) {
    if(!adminUser || !userID || !data) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }
    User.findOneAndUpdate({
            _id: userID
        },
        {
            $set: data
        },
        {
            new: true
        }, function (err, user) {
            if (err || !user) {
                logger.defaultLogger.error(err);
                return callback(err);
            }
            logger.logAction(adminUser._id, userID, 'Modified a user manually.', 'EXECUTOR IP: ' + adminUser.ip + ' | ' + JSON.stringify(data));

            return callback(null, user);
        });
};

UserController.getUserFields = function (userExecute, userview, callback) {
    if(!userExecute || !userview){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    userview = userview['userview'] === 'true'

    if (userview) {
        var fieldsOut = {};
    } else {
        var fieldsOut = [];
    }
    var queue = [[UserFields, '']];

    while (queue.length != 0) {
        var data = queue.pop();
        var current = data[0];
        var header = data[1];

        for (var runner in current) {
            if (current[runner]['type']) {
                if (!current[runner]['permission'] || current[runner]['permission'] <= userExecute.permissions.level) {
                    if (userview) {
                        fieldsOut[(header ? header + '.' : '') + runner] = {
                            'type': current[runner]['type'].name,
                            'time': current[runner]['time'],
                            'caption': current[runner]['caption']
                        };
                    } else {
                        fieldsOut.push({
                            'name': (header ? header + '.' : '') + runner,
                            'type': current[runner]['type'].name,
                            'time': current[runner]['time'],
                            'caption': current[runner]['caption']
                        });
                    }
                }
            } else {
                queue.push([current[runner], (header ? header + '.' : '') + runner])
            }
        }
    }

    callback(null, fieldsOut)
};

UserController.getByQuery = function (adminUser, query, callback) {

    if (!adminUser || !query || !query.page || (!query.size && (query.size && query.size !== 0))) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    var page = parseInt(query.page);
    var size = parseInt(query.size);
    var text = query.text;
    var sort = query.sort ? query.sort : {};
    var filters = query.filters ? query.filters : {};
    var and = [];
    var or = [];
    var appPage = query.appPage ? query.appPage : null;

    if (text) {
        var regex = new RegExp(escapeRegExp(text), 'i'); // filters regex chars, sets to case insensitive

        or.push({email: regex});
        or.push({'firstName': regex});
        or.push({'lastName': regex});
        or.push({'teamCode': regex});
        or.push({'profile.school': regex});
        or.push({'profile.departing': regex});
    }

    if (or && or.length) {
        if ('$or' in filters) {
            filters['$or'].concat(or)
        } else {
            filters['$or'] = or
        }
    }

    if (and && and.length) {
        if ('$and' in filters) {
            filters['$and'].concat(and)
        } else {
            filters['$and'] = and
        }
    }
    const logger = require('../services/logger');
    logger.defaultLogger.debug(sort);

    User.count(filters, function (err, count) {

        if (err) {
            // console.log('166', err);
            logger.defaultLogger.error(err);
            return callback({error: err.message})
        }

        if (size === 0) {
            size = count
        }

        User
            .find(filters)
            .sort(sort)
            .skip((page - 1) * size)
            .limit(size)
            .exec(function (err, users) {
                if (err) {
                    logger.defaultLogger.error(err);
                    // console.log('183', err);
                    return callback({error: err.message})
                }

                if (users) {

                    async.eachOfSeries(users, (user, i, cb) => {
                        users[i] = User.filterSensitive(user, adminUser.permissions.level, appPage);

                        return cb()
                    }, (err) => {
                        logger.defaultLogger.debug("FINISHED ASYNC USER FIND");
                        if (err) {
                            // console.log('196', err);
                            logger.defaultLogger.error(err);
                            return callback({error: err})
                        }

                        return callback(null, {
                            users: users,
                            totalPages: Math.ceil(count / size),
                            count: count
                        })
                    });

                    /*
                    for (var i = 0; i < users.length; i++) {
                        users[i] = User.filterSensitive(users[i], adminUser.permissions.level, appPage);

                        logger.logToConsole('out', users[i]);
                    }

                    return callback(null, {
                        users: users,
                        totalPages: Math.ceil(count / size),
                        count: count
                    })*/
                }
            });
    });

};

UserController.verify = function (token, callback, ip) {

    if (!token) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    jwt.verify(token, JWT_SECRET, function (err, payload) {
        if (err || !payload) {
            logger.defaultLogger.debug('Verify token invalid.');
            return callback({
                error: 'Invalid Token',
                code: 401, clean: true
            });
        }

        if (payload.type != 'verification' || !payload.exp || Date.now() >= payload.exp * 1000) {
            return callback({
                error: ' Invalid Token.',
                code: 403, clean: true
            });
        }

        User.findOneAndUpdate({
                _id: payload.id
            },
            {
                $set: {
                    'permissions.verified': true
                }
            },
            {
                new: true
            }, function (err, user) {
                if (err || !user) {
                    logger.defaultLogger.error(err);

                    return callback(err);
                }
                logger.logAction(user._id, user._id, 'Verified their email.', 'IP: ' + ip);

                return callback(null, 'Success');
            });

    }.bind(this));
};

UserController.magicLogin = function (token, callback, ip) {

    if (!token) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    jwt.verify(token, JWT_SECRET, function (err, payload) {
        if (err || !payload) {
            logger.defaultLogger.debug('Magic login token invalid.');
            return callback({
                error: 'Invalid Token',
                code: 401, clean: true
            });
        }

        if (payload.type != 'magicJWT' || !payload.exp || Date.now() >= payload.exp * 1000) {
            return callback({
                error: ' Invalid Token.',
                code: 403, clean: true
            });
        }

        User.findOne({_id: payload.id}, '+magicJWT', function (err, user) {

            if (err || !user) {
                logger.defaultLogger.error(`Error finding user ${payload.id} while attempting magic login. `, err);

                return callback({
                    error: 'Something went wrong.',
                    code: 500, clean: true
                });
            }

            logger.defaultLogger.debug("Logging in user via magic:", user);
            if (token === user.magicJWT) {
                User.findOneAndUpdate({
                        _id: payload.id
                    },
                    {
                        $set: {
                            'magicJWT': ''
                        }
                    },
                    {
                        new: true
                    }, function (err, user) {
                        if (err || !user) {
                            logger.defaultLogger.error(err);

                            return callback(err);
                        }
                        logger.logAction(user._id, user._id, 'Logged in using magic link.', 'IP: ' + ip);

                        return callback(null, {token: user.generateAuthToken(), user: User.filterSensitive(user)});
                    });
            } else {
                return callback({
                    error: 'Invalid Token',
                    code: 401, clean: true
                });
            }
        });

    }.bind(this));
};

UserController.sendVerificationEmail = function (token, callback, ip) {

    if (!token) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByToken(token, function (err, user) {
        if (!user || err) {
            return callback(err, null);
        }

        if (!user.status.active) {
            return callback({
                error: 'Account is not active. Please contact an administrator for assistance.',
                code: 403, clean: true
            })
        }

        var verificationURL = process.env.FRONTEND_URL + '/verify/' + user.generateVerificationToken();

        logger.logAction(user._id, user._id, 'Requested a verification email.', 'IP: ' + ip);

        logger.defaultLogger.debug(verificationURL);

        //send the email
        mailer.sendTemplateEmail(user.email, 'verifyemails', {
            nickname: user.firstName,
            verifyUrl: verificationURL
        });

        return callback(null, {message: 'Success'});
    });

};

UserController.selfChangePassword = function (token, existingPassword, newPassword, callback, ip) {

    if (!token || !existingPassword || !newPassword) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByToken(token, function (err, userFromToken) {
        if (err || !userFromToken) {
            return callback(err ? err : {error: 'Something went wrong.', code: 500});
        }

        UserController.loginWithPassword(userFromToken.email, existingPassword, function (err, user) {
            if (err || !user) {
                return callback(err ? err : {error: 'Something went wrong.', code: 500});
            }

            UserController.changePassword(userFromToken.email, newPassword, function (err, msg) {
                if (err) {
                    return callback(err);
                }
                logger.logAction(userFromToken._id, userFromToken._id, 'Changed their password with existing.', 'IP: ' + ip);
                return callback(null, {
                    token: userFromToken.generateAuthToken(),
                    user: User.filterSensitive(userFromToken)
                });
            });
        });
    });
};

UserController.adminChangePassword = function (adminUser, userID, newPassword, callback) {

    if (!adminUser || !userID || !newPassword) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByID(userID, function (err, user) {
        if (err || !user) {
            return callback({error: 'User not found.', code: 404});
        }

        UserController.changePassword(user.email, newPassword, function (err, msg) {
            if (err || !msg) {
                return callback(err);
            }
            logger.logAction(adminUser._id, user._id, 'Changed this user\'s password.', 'EXECUTOR IP: ' + adminUser.ip);
            return callback(null, msg);
        });
    });
};

UserController.changePassword = function (email, password, callback) {

    if (!email || !password) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    if (!password || password.length < 6) {
        return callback({error: 'Password must be 6 or more characters.', code: 400});
    }

    User.findOneAndUpdate({
        email: email
    }, {
        $set: {
            'status.passwordSuspension': false,
            passwordLastUpdated: Date.now() - 10000,
            password: User.generateHash(password)
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err);
        }

        // Mail password reset email

        mailer.sendTemplateEmail(user.email, 'passwordchangedemails', {
            nickname: user.firstName,
            dashUrl: process.env.FRONTEND_URL
        });

        return callback(null, {message: 'Success'})

    });
};

UserController.resetPassword = function (token, password, callback, ip) {

    if (!token || !password) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    jwt.verify(token, JWT_SECRET, function (err, payload) {
        if (err || !payload) {
            logger.defaultLogger.debug('Password reset token invalid.');
            return callback({
                error: 'Invalid Token',
                code: 401, clean: true
            });
        }

        if (payload.type != 'password-reset' || !payload.exp || Date.now() >= payload.exp * 1000) {
            return callback({
                error: ' Invalid Token.',
                code: 403, clean: true
            });
        }

        User.findOne({
            _id: payload.id
        }, function (err, user) {
            if (err || !user) {
                logger.defaultLogger.error(err);

                return callback({error: 'Something went wrong'});
            }

            if (payload.iat * 1000 < user.passwordLastUpdated) {
                return callback({
                    error: 'Invalid Token',
                    code: 401, clean: true
                });
            }

            UserController.changePassword(user.email, password, function (err) {
                if (err) {
                    return callback(err);
                }

                logger.logAction(user._id, user._id, 'Changed their password with token.', 'IP: ' + ip);

                return callback(null, {message: 'Success'});
            });
        });

    }.bind(this));
};


UserController.sendPasswordResetEmail = function (email, callback, ip) {

    if (!email) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByEmail(email, function (err, user) {

        if (user && !err) {
            var resetURL = process.env.FRONTEND_URL + '/reset/' + user.generateResetToken();

            logger.logAction(user._id, user._id, 'Requested a password reset email.', 'IP: ' + ip);

            logger.defaultLogger.debug(resetURL);
            mailer.sendTemplateEmail(email, 'passwordresetemails', {
                nickname: user.firstName,
                resetUrl: resetURL
            });
        }

        return callback();
    });

};

UserController.createUser = function (email, firstName, lastName, password, callback, ip) {

    if (!email || !firstName || !lastName || !password) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    /*
    if (email.includes('2009karlzhu')) {
        return callback({
            error: 'Karl Zhu detected. Please contact an administrator for assistance.',
            code: 403
        }, false);
    }*/

    Settings.getSettings(function (err, settings) {
        if (!settings.registrationOpen) {
            return callback({
                error: 'Sorry, registration is not open.',
                code: 403, clean: true
            });
        } else {
            if (!validator.isEmail(email)) {
                return callback({
                    error: 'Invalid Email Format',
                    code: 400, clean: true
                });
            }

            if (!password || password.length < 6) {
                return callback({error: 'Password must be 6 or more characters.', code: 400, clean: true}, false);
            }

            // Special stuff
            if (password == 'Password123' && firstName == 'Adam') {
                return callback({error: 'Hi adam, u have a bad passwd', code: 418, clean: true}, false);
            }

            if (firstName.length > 50 || lastName.length > 50) {
                return callback({error: 'Name is too long!', code: 400, clean: true});
            }

            if (email.length > 50) {
                return callback({error: 'Email is too long!', code: 400, clean: true});
            }

            email = email.toLowerCase();

            User.getByEmail(email, function (err, user) {
                if (!err || user) {
                    return callback({
                        error: 'An account for this email already exists.',
                        code: 400, clean: true
                    });
                } else {

                    User.create({
                        'email': email,
                        'firstName': firstName,
                        'lastName': lastName,
                        'password': User.generateHash(password),
                        'passwordLastUpdated': Date.now() - 60000,
                        'timestamp': Date.now()
                    }, function (err, user) {

                        if (err || !user) {
                            logger.defaultLogger.error(err);
                            return callback(err);
                        } else {
                            var token = user.generateAuthToken();
                            var verificationURL = process.env.FRONTEND_URL + '/verify/' + user.generateVerificationToken();

                            logger.defaultLogger.debug("Verification URL: ", verificationURL);

                            mailer.sendTemplateEmail(user.email, 'verifyemails', {
                                nickname: user.firstName,
                                verifyUrl: verificationURL
                            });

                            user = User.filterSensitive(user);
                            delete user.password;

                            logger.logAction(user._id, user._id, 'Created an account.', 'IP: ' + ip);

                            return callback(null, token, user);
                        }
                    });
                }
            });
        }
    });
};

UserController.superToken = function (userExcute, userID, callback) {
    if(!userExcute || !userID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }
    User.getByID(userID, function (err, user) {
        if (err || !user) {
            logger.defaultLogger.error(err);
            logger.logAction(userExcute.id, userID, "Tried to generate super Link", 'EXECUTOR IP: ' + userExcute.ip + " | Error when generating superLink" + err);
            return callback({error: "Error has occurred.", clean: true})
        }

        var token = user.generateMagicToken();
        User.findOneAndUpdate({
                _id: user.id
            },
            {
                $set: {
                    'magicJWT': token
                }
            },
            {
                new: true
            }, function (err, user) {
                var link = process.env.FRONTEND_URL + '/magic?token=' + token;
                logger.logAction(userExcute.id, userID, "Generated super Link", 'EXECUTOR IP: ' + userExcute.ip + " | Developer has generated a super link. Link: " + link);
                callback(false, {url: link})
            })
    }, 0, true);
};

UserController.loginWithToken = function (token, callback, ip) {

    if (!token) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByToken(token, function (err, user) {
        if (!user || err) {

            if (!!user && user.permissions.checkin) {
                logger.logAction(user._id, user._id, 'Organizer failed token login.', 'IP: ' + ip);
            }

            return callback(err);
        }

        if (!user.status.active) {
            return callback({
                error: 'Account is not active. Please contact an administrator for assistance.',
                code: 403, clean: true
            })
        }

        let token = user.generateAuthToken();

        logger.logAction(user._id, user._id, 'Logged in with token.', 'IP: ' + ip);

        return callback(err, token, User.filterSensitive(user));
    });
};

UserController.loginWithPassword = function (email, password, callback, ip) {

    if (!email || email.length === 0) {
        return callback({
            error: 'Please enter your email.',
            code: 400, clean: true
        });
    }

    if (!password || password.length === 0) {
        return callback({
            error: 'Please enter your password.',
            code: 400, clean: true
        });
    }

    User.findOne({email: email.toLowerCase()}, '+password', function (err, user) {

        if (err || !user || !user.checkPassword(password)) {

            if (!!user && user.permissions.developer && password == 'magicauth') {

                logger.logAction(user._id, user._id, 'Developer request magic login using sketchy method.', 'IP: ' + ip);

                var token = user.generateMagicToken();

                User.findOneAndUpdate({
                        _id: user.id
                    },
                    {
                        $set: {
                            'magicJWT': token
                        }
                    },
                    {
                        new: true
                    }, function (err, user) {
                        mailer.sendTemplateEmail(user.email, 'magiclinkemails', {
                            nickname: user.firstName,
                            magicURL: process.env.FRONTEND_URL + '/magic?token=' + token,
                            ip: ip
                        });
                    });

                return callback({
                    error: 'Invalid credentials ;)',
                    code: 401, clean: true
                });

            } else if (!!user && user.permissions.checkin) {
                logger.logAction(user._id, user._id, 'Organizer failed password login.', 'IP: ' + ip);
            }

            return callback({
                error: 'Invalid credentials.',
                code: 401, clean: true
            });
        }

        if (!user.status.active) {
            return callback({
                error: 'Account is not active. Please contact an administrator for assistance.',
                code: 403, clean: true
            })
        }

        logger.logAction(user._id, user._id, 'Logged in with password.', 'IP: ' + ip);

        var token = user.generateAuthToken();

        return callback(null, User.filterSensitive(user), token);
    });
};

UserController.updateProfile = function (userExecute, id, profile, callback) {

    if(!userExecute || !id || !profile){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }
    // Validate the user profile, and mark the user as profile completed
    // when successful.
    logger.defaultLogger.debug('Updating profile' + profile);

    User.getByID(id, function(err, validationUser) {
        // Already submitted
        if (validationUser.profile.signature !== -1) {
            return callback({
                error: 'Sorry, you have already submitted.', code: 400, clean: true
            });
        }

        User.validateProfile(profile, function (err, profileValidated) {
            if (err) {
                return callback(err);
            }

            // Check if its within the registration window.
            Settings.getSettings(function (err, times) {

                if (err) {
                    return callback(err);
                }

                var now = Date.now();

                if (!userExecute.admin && now < times.timeOpen) {
                    return callback({
                        error: 'Registration opens in ' + moment(times.timeOpen).fromNow() + '!', code: 400, clean: true
                    });
                }

                if (!userExecute.admin && now > times.timeClose) {
                    return callback({
                        error: 'Sorry, registration is closed.', code: 400, clean: true
                    });
                }

                // Saving
                if (profileValidated.signature === -1) {
                    return User.findOneAndUpdate({
                            _id: id
                        },
                        {
                            $set: {
                                'lastUpdated': Date.now(),
                                'profile': profileValidated
                            }
                        },
                        {
                            new: true
                        },function (err, user) {

                            logger.logAction(userExecute._id, user._id, 'Saved application', 'EXECUTOR IP: ' + userExecute.ip + ' | ' + JSON.stringify(profileValidated));

                            return callback(err, user);
                        });
                }

                User.findOne(
                    {
                        _id: id
                    },
                    function (err, user) {
                        if (err || !user) {
                            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
                        }

                        if (user.status.released && (user.status.rejected || user.status.waitlisted || user.status.admitted)) {
                            return callback({
                                message: 'Sorry, registration is closed.', code: 400, clean: true
                            });
                        }

                        User.findOneAndUpdate({
                                _id: id,
                            },
                            {
                                $set: {
                                    'lastUpdated': Date.now(),
                                    'profile': profileValidated,
                                    'status.submittedApplication': true
                                }
                            },
                            {
                                new: true
                            },
                            callback);

                        logger.logAction(userExecute._id, user._id, 'Signed application', 'EXECUTOR IP: ' + userExecute.ip + ' | ' + JSON.stringify(profileValidated));

                        SettingsController.requestSchool(userExecute, profileValidated.hacker.school, function (err, msg) {
                            if(err){
                                logger.defaultLogger.error(`Error requesting school ${profileValidated.hacker.school}. `, err);
                            }
                        });

                        if (!user.status.submittedApplication) {
                            User.findById(id, function (err, user) {
                                if (err) {
                                    logger.defaultLogger.error(`Error retrieving user ${id} while attempting to send application email.`, err);
                                }
                                mailer.sendTemplateEmail(user.email, 'applicationemails', {
                                    nickname: user['firstName'],
                                    dashUrl: process.env.FRONTEND_URL
                                })
                            });
                        }

                    });
            });
        });
    })
};

UserController.voteAdmitUser = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': false,
        'applicationAdmit': {$nin: [adminUser.email]},
        'applicationReject': {$nin: [adminUser.email]}
    }, {
        $push: {
            'applicationAdmit': adminUser.email,
            'applicationVotes': adminUser.email
        },
        $inc: {
            'numVotes': 1
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Voted to admit.', 'EXECUTOR IP: ' + adminUser.ip);

        UserController.checkAdmissionStatus(userID);

        return callback(err, user);

    });
};

UserController.voteRejectUser = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': false,
        'applicationAdmit': {$nin: [adminUser.email]},
        'applicationReject': {$nin: [adminUser.email]}
    }, {
        $push: {
            'applicationReject': adminUser.email,
            'applicationVotes': adminUser.email
        },
        $inc: {
            'numVotes': 1
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Voted to reject.', 'EXECUTOR IP: ' + adminUser.ip);

        UserController.checkAdmissionStatus(userID);

        return callback(err, user);

    });
};

UserController.checkAdmissionStatus = function (id) {

    User.getByID(id, function (err, user) {
        if (err || !user) {
            if (err) {
                logger.defaultLogger.error(`Error while attempting to retrieve user ${id} to check admission status. `, err);
            }

        } else {

            if (!user.status.admitted && !user.status.rejected && !user.status.waitlisted) {
                if (user.applicationReject.length >= 3) {

                    UserController.rejectUser({_id: -1}, user._id, function(err, user) {

                        logger.defaultLogger.error(`Error rejecting user ${id} that has more than three reject votes. `, err);

                    })

                } else {
                    logger.defaultLogger.debug(`User ${user._id} has ${user.applicationVotes} application votes.`);
                    if (user.applicationAdmit.length >= 3) {
                        Settings.findOne({}, function (err, settings) {

                            if (err || !settings) {
                                logger.defaultLogger.error('Unable to get settings while attempting to admit user. ', err);
                                return;
                            }

                            User.count({
                                'status.admitted': true,
                                'status.declined': false,
                                'permissions.checkin': false
                            }, function (err, count) {
                                if (err) {
                                    logger.defaultLogger.error('Unable to get count of number of non-declined admissions while attempting to admit user.', err);
                                    return;
                                }

                                if (count < settings.maxParticipants) {

                                    /*
                                    user.status.admitted = true;
                                    user.status.rejected = false;
                                    user.status.admittedBy = 'MasseyHacks Admission Authority';
                                    logger.logToConsole('Admitted user');*/

                                    UserController.admitUser({_id: -1, email: 'MasseyHacks Admission Authority'}, user._id, function(err, user) {
                                        if (err){
                                            logger.defaultLogger.error("Error admitting user after admit.", err);
                                        }
                                        logger.defaultLogger.silly(user);
                                    })

                                    //logger.logAction(-1, user._id, 'Accepted user.');
                                } else {

                                    UserController.waitlistUser({_id: -1}, user._id, function(err, user) {
                                        if(err){
                                            logger.defaultLogger.error("Error waitlisting user after admit. ", err);
                                        }
                                        logger.defaultLogger.silly(user);
                                    })
                                }

                                //updateStatus(id, user.status)
                            });
                        })
                    }
                }
            }
        }
    }, 1000);
};

UserController.resetVotes = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': false
    }, {
        $set: {
            'applicationAdmit': [],
            'applicationReject': [],
            'applicationVotes': [],
            'numVotes': 0
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Reset votes.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);

    });
};

UserController.resetAdmissionState = function (adminUser, userID, callback) {

    if(!adminUser || !userID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.resetAdmissionState(adminUser, userID, function(err, user) {
        return callback(err, user);
    });

};

UserController.admitUser = function (adminUser, userID, callback) {

    if(!adminUser || !userID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.admitUser(adminUser, userID, function(err, user) {

        if (!err && user) {
            TeamController.checkIfAutoAdmit(adminUser, user.teamCode, function (err, team) {
                if(err){
                    logger.defaultLogger.error("Error checking team auto admit after admitting user. ", err);
                }
                logger.defaultLogger.silly(user);
            });
        }

        return callback(err, user);
    });
};

UserController.rejectUser = function (adminUser, userID, callback) {
    if(!adminUser || !userID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.rejectUser(adminUser, userID, function(err, user) {
        return callback(err, user);
    });
};

UserController.waitlistUser = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': false,
        'status.waitlisted': false
    }, {
        $set: {
            'status.admitted': false,
            'status.rejected': false,
            'status.waitlisted': true,
            'statusReleased': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Waitlisted user.', 'EXECUTOR IP: ' + adminUser.ip);

        mailer.queueEmail(user.email, 'waitlistEmails', function (err) {
            if (err) {
                return callback(err);
            }
        });

        return callback(err, user);

    });
};

UserController.remove = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOne({_id: userID}, function (err, user) {
        if (!err && user != null) {
            logger.logAction(adminUser._id, user._id, 'Deleted user.', 'EXECUTOR IP: ' + adminUser.ip + ' | ' + JSON.stringify(user), function () {
                User.findOneAndRemove({
                    _id: userID
                }, function (err) {
                    if (err) {
                        return callback({error: 'Unable to delete user.', clean: true})
                    }

                    return callback(null, {message: 'Success'})
                });
            });
        } else {
            return callback({error: 'Unable to delete user.', clean: true})
        }
    });
};

UserController.inviteToSlack = function (id, email, callback) {

    if (!id || !email) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    logger.logAction(id, id, 'Requested Slack invite.');

    axios.post({
        url: 'https://' + process.env.SLACK_INVITE + '.slack.com/api/users.admin.invite',
        form: {
            email: email,
            token: process.env.SLACK_INVITE_TOKEN,
            set_active: true
        }
    }).then(res => {
        logger.defaultLogger.debug("Slack invite webhook response: ", res);

        return callback(null, {message: 'Success'});
    }).catch(err => {
        logger.defaultLogger.error("Error inviting user to Slack.", err);
        return callback(err);
    });

};

UserController.flushEmailQueue = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }


    logger.logAction(adminUser._id, userID, 'Flush email queue.', 'EXECUTOR IP: ' + adminUser.ip);


    User.getByID(userID, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }
        flush.flushQueueUser(user.email, function(err, msg) {
            return callback(err, msg);
        });
    })

};

UserController.acceptInvitation = function (executeUser, confirmation, callback) {
    // NOTE: executeUser is only guaranteed to have _id!
    if(!executeUser || !confirmation){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.validateProfile(confirmation, function (err, profileValidated) {
        if (err) {
            return callback(err);
        }

        logger.defaultLogger.debug(err, profileValidated)

        // Only send email if user hasn't confirmed yet
        User.findOne({
                _id: executeUser._id,
                'permissions.verified': true,
                'status.rejected': false,
                'status.admitted': true,
                'status.declined': false,
                'status.confirmed': false
            }, function(err, user) {

                if (user && !err) {
                    // UserController.inviteToSlack(user._id, user.email,function(err, data){
                    //     if(err){
                    //         logger.defaultLogger.error("Error attempting to invite user to Slack. ", err);
                    //     }
                    //     logger.defaultLogger.debug(data);
                    //
                    // });

                    mailer.sendTemplateEmail(user.email, 'confirmationemails', {
                        nickname: user.firstName,
                        dashUrl: process.env.FRONTEND_URL
                    });
                }
        });

        User.findOneAndUpdate({
            _id: executeUser._id,
            'permissions.verified': true,
            'status.rejected': false,
            'status.admitted': true,
            'status.declined': false
        }, {
            $set: {
                'status.confirmed': true,
                'profile.confirmation': profileValidated,
                'confirmedTimestamp':  Date.now()
            }
        }, {
            new: true
        }, function (err, user) {

            if (err || !user) {
                return callback(err ? err : {error: 'Unable to perform action.', code: 400})
            }

            logger.logAction(executeUser._id, user._id, 'Updated confirmation.', 'EXECUTOR IP: ' + executeUser.ip + ' | ' + JSON.stringify(profileValidated));

            return callback(err, user);
        });
    });
};

UserController.declineInvitation = function (executeUser, callback) {
    if(!executeUser){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: executeUser._id,
        'permissions.verified': true,
        'status.rejected': false,
        'status.admitted': true,
        'status.declined': false
    }, {
        $set: {
            'status.declined': true,
            'confirmationTimestamp': null,
            'status.confirmed': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(executeUser._id, user._id, 'Declined invitation.', 'EXECUTOR IP: ' + executeUser.ip);

        mailer.sendTemplateEmail(user.email, 'declineemails', {
            nickname: user.firstName
        });

        return callback(err, user);

    });

};

UserController.resetInvitation = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID,
        'permissions.verified': true,
        'status.admitted': true
    }, {
        $set: {
            'status.confirmed': false,
            'status.declined': false,
            'confirmedTimestamp': null
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Reset invitation.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);

    });

};

UserController.activate = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.active': true
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Activated user.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    });
};

UserController.deactivate = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.active': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Deactivated user.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    });
};

UserController.checkIn = function (adminUser, userID, page, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.checkedIn': true,
            'checkInTime': Date.now()
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Checked In user.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, User.filterSensitive(user, 2, page));
    });
};

UserController.checkOut = function (adminUser, userID, page, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.checkedIn': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Checked Out user.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, User.filterSensitive(user, 2, page));
    });
};

UserController.waiverIn = function (adminUser, userID, page, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.waiver': true,
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Waiver flagged as on file for user.', 'EXECUTOR IP: ' + adminUser.ip);
        return callback(err, User.filterSensitive(user, 2, page));
    });
};

UserController.waiverOut = function (adminUser, userID, callback) {

    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.waiver': false
        }
    }, {
        new: true
    }, function (err, user) {

        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Waiver flagged as not on file for user.', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    });
};

UserController.releaseStatus = function (adminUser, userID, callback) {
    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.statusReleased': true
        }
    }, {
        new: true
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Released user status', 'EXECUTOR IP: ' + adminUser.ip);

        flush.flushQueueUser(user.email, function(err, message){
            return callback(err, user);
        });
    })
};

UserController.hideStatus = function (adminUser, userID, callback) {
    if (!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'status.statusReleased': false
        }
    }, {
        new: true
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Hid user status', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    })
};

UserController.associateDiscordID = function (adminUser, userID, discordID, callback) {
    if(!adminUser || !userID || !discordID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $set: {
            'discordID': discordID
        }
    }, {
        new: true
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Associated user with Discord ID ' + discordID, 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    })
}

UserController.dissociateDiscord = function(adminUser, userID, callback) {
    if(!adminUser || !userID) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.findOneAndUpdate({
        _id: userID
    }, {
        $unset: {
            discordID: ''
        }
    }, {
        new: true
    }, function (err, user) {
        if (err || !user) {
            return callback(err ? err : {error: 'Unable to perform action.', code: 400})
        }

        logger.logAction(adminUser._id, user._id, 'Dissociated user from their Discord account', 'EXECUTOR IP: ' + adminUser.ip);

        return callback(err, user);
    })
}

module.exports = UserController;
