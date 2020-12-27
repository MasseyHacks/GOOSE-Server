const async    = require('async');
const User     = require('../models/User');
const Settings = require('../models/Settings');
const fs       = require('fs');
const logger   = require('../services/logger');

// In memory stats.
var stats = {};

function calculateStats(callback) {
    logger.defaultLogger.info('Calculating stats...');

    var charLength = [];

    var newStats = {
        lastUpdated: 0,

        total: 0,
        votes: {},
        skill: {},
        avgCharLength: 0,

        demo: {
            gender: {
                'Male': 0,
                'Female': 0,
                'Other': 0,
                'I prefer not to answer': 0
            },
            massey: 0,
            nonmassey: 0,
            grade: {
                '<=8': 0,
                '9': 0,
                '10': 0,
                '11': 0,
                '12': 0,
            }
        },

        shirtSizes: {
            'XS':0,
            'S': 0,
            'M': 0,
            'L': 0,
            'XL':0,
        },

        confirmedStat : {

            total: 0,
            bus: 0,

            demo: {
                gender: {
                    'Male': 0,
                    'Female': 0,
                    'Other': 0,
                    'I prefer not to answer': 0
                },
                massey: 0,
                nonmassey: 0,
                grade: {
                    '<=8': 0,
                    '9': 0,
                    '10': 0,
                    '11': 0,
                    '12': 0,
                }
            },

            shirtSizes: {
                'XS':0,
                'S': 0,
                'M': 0,
                'L': 0,
                'XL':0,
            },
            dietaryRestrictions: {}
        },

        verified: 0,
        submitted: 0,
        admitted: 0,
        waitlisted: 0,
        confirmed: 0,
        declined: 0,
        waiver: 0,
        rejected: 0,
        checkedIn: 0,
        released: 0,
        bus: 0,

        dietaryRestrictions: {},

        tabs: 0,
        spaces: 0

    };


    User
        .find({'permissions.admin':true})
        .exec(function(err, adminUsers) {
            if (err || !adminUsers) {
                throw err;
            }

            for (var i = 0; i < adminUsers.length; i++) {
                newStats.skill[adminUsers[i].email] = [adminUsers[i].fullName, adminUsers[i].skillRequest, adminUsers[i].skillPass, adminUsers[i].skillFail];
            }

        });

            User
        .find({'permissions.reviewer':true})
        .exec(function(err, adminUsers) {
            if (err || !adminUsers) {
                throw err;
            }

            for (var i = 0; i < adminUsers.length; i++) {
                newStats.votes[adminUsers[i].email] = [adminUsers[i].fullName, 0, 0, 0, adminUsers[i].permissions.developer];
            }


            User
                .find({'permissions.checkin': false, 'permissions.admin': false, 'permissions.owner':false})
                .exec(function(err, users){
                    if (err || !users){
                        throw err;
                    }

                    newStats.total = users.length;

                    async.each(users, function(user, callback){


                        for (var i = 0; i < user.applicationVotes.length; i++) {
                            if (user.applicationVotes[i] in newStats.votes) {
                                newStats.votes[user.applicationVotes[i]][1] += 1;

                                if (user.applicationAdmit.includes(user.applicationVotes[i])) {
                                    newStats.votes[user.applicationVotes[i]][2] += 1;
                                }

                                if (user.applicationReject.includes(user.applicationVotes[i])) {
                                    newStats.votes[user.applicationVotes[i]][3] += 1;
                                }
                            }
                        }

                        // Count verified
                        newStats.verified += user.permissions.verified ? 1 : 0;

                        newStats.rejected += user.status.rejected ? 1 : 0;

                        newStats.waitlisted += user.status.waitlisted ? 1 : 0;

                        // Count submitted
                        newStats.submitted += user.status.submittedApplication ? 1 : 0;

                        // Count accepted
                        newStats.admitted += user.status.admitted ? 1 : 0;

                        // Count confirmed
                        newStats.confirmed += user.status.confirmed ? 1 : 0;

                        newStats.waiver += user.status.waiver ? 1 : 0;

                        // Count declined
                        newStats.declined += user.status.declined ? 1 : 0;

                        // Count checked in
                        newStats.checkedIn += user.status.checkedIn ? 1 : 0;

                        // Count released
                        newStats.released += user.status.statusReleased ? 1 : 0;

                        if (user.status.submittedApplication) {

                            newStats.spaces += user.profile.hacker.tabsOrSpaces == "Spaces";
                            newStats.tabs += user.profile.hacker.tabsOrSpaces == "Tabs";

                            newStats.bus += user.profile.hacker.bus ? 1 : 0;
                            try {
                                if (user.status.admitted) {
                                    charLength.push(user.profile['hacker']['fullResponse1'].length)
                                    charLength.push(user.profile['hacker']['fullResponse2'].length)
                                }
                            } catch (e) {

                            }

                            // Add to the gender
                            if (user.profile.hacker.gender) {
                                newStats.demo.gender[user.profile.hacker.gender] += 1;
                            } else {
                                //"I prefer not to answer"
                                newStats.demo.gender["I prefer not to answer"] += 1;
                            }

                            if (user.profile.hacker.grade) {
                                newStats.demo.grade[user.profile.hacker.grade] += 1;
                            }

                            // Count shirt sizes
                            if (user.profile.hacker.shirt in newStats.shirtSizes) {
                                newStats.shirtSizes[user.profile.hacker.shirt] += 1;
                            }
                            // Dietary restrictions
                            if (user.profile.hacker.dietaryRestrictions) {
                                user.profile.hacker.dietaryRestrictions.forEach(function (restriction) {
                                    if (!newStats.dietaryRestrictions[restriction]) {
                                        newStats.dietaryRestrictions[restriction] = 0;
                                    }
                                    newStats.dietaryRestrictions[restriction] += 1;
                                });
                            }

                            if (user.profile.hacker.school) {
                                if (user.profile.hacker.school.toLowerCase().includes('massey')) {
                                    newStats.demo.massey += 1;
                                }
                                else {
                                    newStats.demo.nonmassey += 1;
                                }
                            }
                        }

                        if (user.status.confirmed) {

                            newStats.confirmedStat.total += 1;
                            newStats.confirmedStat.bus += user.profile.confirmation.bus ? 1 : 0;

                            // Add to the gender
                            if (user.profile.hacker.gender) {
                                newStats.confirmedStat.demo.gender[user.profile.hacker.gender] += 1;
                            } else {
                                //"I prefer not to answer"
                                newStats.confirmedStat.demo.gender["I prefer not to answer"] += 1;
                            }

                            if (user.profile.hacker.grade){
                                newStats.confirmedStat.demo.grade[user.profile.hacker.grade] += 1;
                            }

                            // Count shirt sizes
                            if (user.profile.hacker.shirt in newStats.confirmedStat.shirtSizes) {
                                newStats.confirmedStat.shirtSizes[user.profile.hacker.shirt] += 1;
                            }
                            // Dietary restrictions
                            if (user.profile.hacker.dietaryRestrictions) {
                                user.profile.hacker.dietaryRestrictions.forEach(function (restriction) {
                                    if (!newStats.confirmedStat.dietaryRestrictions[restriction]){
                                        newStats.confirmedStat.dietaryRestrictions[restriction] = 0;
                                    }
                                    newStats.confirmedStat.dietaryRestrictions[restriction] += 1;
                                });
                            }

                            if (user.profile.hacker.school) {
                                if (user.profile.hacker.school.toLowerCase().includes('massey')) {
                                    newStats.confirmedStat.demo.massey += 1;
                                }
                                else {
                                    newStats.confirmedStat.demo.nonmassey += 1;
                                }
                            }

                        }


                        callback(); // let async know we've finished
                    }, function() {

                        newStats.avgCharLength = charLength.reduce(function(a, b) {return a + b}, 0) / charLength.length

                        // Transform dietary restrictions into a series of objects
                        var restrictions = [];
                        Object.keys(newStats.dietaryRestrictions)
                            .forEach(function (key) {
                                restrictions.push({
                                    name: key,
                                    count: newStats.dietaryRestrictions[key]
                                });
                            });
                        newStats.dietaryRestrictions = restrictions;

                        var confirmedRestrictions = [];
                        Object.keys(newStats.confirmedStat.dietaryRestrictions)
                            .forEach(function (key) {
                                confirmedRestrictions.push({
                                    name: key,
                                    count: newStats.confirmedStat.dietaryRestrictions[key]
                                });
                            });
                        newStats.confirmedStat.dietaryRestrictions = confirmedRestrictions;

                        logger.defaultLogger.info('Stats updated!');
                        newStats.lastUpdated = new Date();
                        stats = newStats;

                        if (callback) return callback(stats)
                    });
                });
        });
}

var Stats = {};

Stats.refreshStats = function(callback) {
    calculateStats(function(stats) {
        return callback(null, stats);
    });
};

Stats.getStats = function(){
    return stats;
};

Stats.startService = function() {
    calculateStats();
    setInterval(function () {
        calculateStats();
    }, 600000);
};

module.exports = Stats;
