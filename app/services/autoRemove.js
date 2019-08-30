const async  = require('async');
const User   = require('../models/User');
const logger = require('./logger');

function removeUnverifiedUser(){
    var now = Date.now();

    // Only delete users below checkin
    User.find({'permissions.level' : { $eq : 0 }}, function(err, users) {
        if (err || !users) {
            throw err;
        }

        async.each(users, function (user, callback) {
            if (now - user.timestamp > 86400000){
                logger.logAction(-1, user._id, 'Deleted user.');
                console.log('Removing ' + user.email);
                User.findOneAndRemove({'id':user.id}, callback);
            }
        })
    });
}

setInterval(function() {
    removeUnverifiedUser();
}, 3600000);

module.exports = removeUnverifiedUser;
