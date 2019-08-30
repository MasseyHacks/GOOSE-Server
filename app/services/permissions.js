const User = require('../models/User');

// Permission Validation
//
// 0 - Hacker Unverified
// 1 - Hacker
// 2 - Check In
// 3 - Admin
// 4 - Review
// 5 - Owner
// 6 - Developer

function getToken(req) {
    var token = req['headers']['x-access-token'] ? req['headers']['x-access-token'] : false;

    if (!token) {
        token = req.body.token;
    }

    return token;
}

module.exports = {

    getToken : function (req)
    {
        return getToken(req);
    },

    isUser : function (req, res, next) {
        var token = getToken(req);
        var userID = req.params.userID == null ? req.body.userID : req.params.userID;

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (userID && user && (user._id == userID || user.permissions.level >= 3)) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isVerified : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level > 0) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isCheckin : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level >= 2) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isAdmin : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level >= 3) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isReviewer : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level >= 4) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isOwner : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level >= 5) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    },

    isDeveloper : function (req, res, next) {
        var token = getToken(req);

        User.getByToken(token, function (err, user) {
            if (err) {
                return res.status(403).send(err);
            }

            if (user && user.permissions.level == 6) {
                req.userExecute = user;
                req.userExecute['ip'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                req.permissionLevel = user.permissions.level;
                return next();
            }

            return res.status(403).send({
                error: 'Access Denied'
            });
        });
    }
};