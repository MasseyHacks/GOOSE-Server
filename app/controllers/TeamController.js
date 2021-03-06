const Team           = require('../models/Team');
const User           = require('../models/User');
const TeamFields     = require('../models/data/TeamFields');
const Settings       = require('../models/Settings');

const logger         = require('../services/logger');
const uuidv4         = require('uuid/v4');

var TeamController   = {};

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

TeamController.checkAllTeams = function(adminUser, callback) {
    Team
        .find({active: true})
        .populate('memberNames')
        .exec(function(err, teams) {

            for (var team in teams) {

                TeamController.checkIfAutoAdmit(adminUser, teams[team].code, function(err, msg) {
                    if(err){
                        logger.defaultLogger.error(err);
                    }
                })
            }

            return callback(null, teams.length)


        });
}

TeamController.checkIfAutoAdmit = function (adminUser, teamCode, callback) {

    Team
        .findOne({
            code : teamCode,
            active: true
        })
        .populate('memberNames')
        .exec(function (err, team) {
            if (err || !team) { // Team doesn't exist
                return callback({ error : 'Team doesn\'t exist', code: 404, clean: true });
            }

            var numAdmitted = 0;
            var numSubmitted = 0;

            if (team.memberNames.length > 2) {
                // Substitutes user objects with their names
                for (var u in team.memberNames) {
                    numAdmitted += team.memberNames[u].status.admitted ? 1 : 0;
                    numSubmitted += team.memberNames[u].status.submittedApplication ? 1 : 0;
                }

                if (numAdmitted >= 2 && numSubmitted > 2) {
                    TeamController.teamAccept(adminUser, teamCode, function (err, team) {
                        return callback(null, team);
                    });
                }
            }

            logger.defaultLogger.debug(`Team ${teamCode} not eligible for auto admit.`)

            return callback({ error : 'Team doesn\'t meet criteria.', code: 400, clean: true});
        });

};

TeamController.teamAccept = function(adminUser, teamCode, callback) {
    TeamController.getByCode(teamCode, function (err, team) {
        if (err || !team) {
            logger.defaultLogger.error(err)
            return callback(err);
        }

        logger.logAction(adminUser._id, -1, 'Admitted team ' + team.name, 'EXECUTOR IP: ' + adminUser.ip);

        for (var teamMember in team.memberNames) {

            if (team.memberNames[teamMember]['status']['submittedApplication'] && !team.memberNames[teamMember]['status']['admitted']) {
                User.resetAdmissionState(adminUser, team.memberNames[teamMember].id, function (err, user) {

                    logger.defaultLogger.debug('Done resetting user status', user.fullName, user)

                    User.admitUser(adminUser, user._id, function (err, user) {
                        if (err || !user) {
                            logger.defaultLogger.error(err)
                        }

                        logger.defaultLogger.debug('Admitted user', user.fullName)
                    })

                });
            }
        }

        return callback(false, team);
    })
};

TeamController.teamReject = function(adminUser, teamCode, callback) {
    TeamController.getByCode(teamCode, function (err, team) {
        if (err || !team) {
            logger.defaultLogger.error(err)
            return callback(err);
        }

        logger.logAction(adminUser._id, -1, 'Rejected team ' + team.name, 'EXECUTOR IP: ' + adminUser.ip);

        for (var teamMember in team.memberNames) {

            User.resetAdmissionState(adminUser, team.memberNames[teamMember].id, function(err, user) {
                User.rejectUser(adminUser, user._id, function (err, user) {
                    if (err || !user) {
                        logger.defaultLogger.error(err)
                    }
                })
            });
        }

        return callback(false, team);
    })
};

TeamController.createTeam = function(id, teamName, callback) {

    if (!id || !teamName) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    if (teamName.length > 50) {
        return callback({error : 'Name is too long! (Max 50)', clean: true})
    }

    User.getByID(id, function(err, user) {
        if (err || !user) {
            return callback({error : 'Unable to get user.', clean: true});
        }

        if (user.teamCode && user.teamCode.length != 0) {
            return callback({error : 'You are already in a team!', clean: true});
        }

        Team.create({
            name: teamName,
            code: uuidv4().substring(0, 7),
            memberIDs: [user._id]
        }, function(err, team) {

            if (err) {
                logger.defaultLogger.error(`Error creating team while attempting to create a team. `, err);
                return callback({error: 'Unable to create team.', clean: true})
            }

            User.findOneAndUpdate({
                _id: id
            }, {
                teamCode: team.code
            }, {
                new: true
            }, function(err, newUser) {
                logger.logAction(id, -1, 'Created the team: ' + teamName + ' (' + team.code + ')');

                team = team.toJSON();
                team.memberNames = [newUser.fullName];

                return callback(null, team);
            });
        });
    });
};

TeamController.joinTeam = function(id, teamCode, callback) {

    if (!id || !teamCode) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByID(id, function(err, user) {
        if (err || !user) {
            return callback({error : 'Unable to get user.', clean: true});
        }

        if (user.teamCode && user.teamCode.length != 0) {
            return callback({error : 'You are already in a team!', code: 400, clean: true});
        }

        Team
            .findOne({
                code : teamCode.trim(),
                active: true
            })
            .select('+memberIDs')
            .exec(function (err, team) {
                if (err || !team) { // Team doesn't exist yet
                    return callback({ error : 'Team doesn\'t exist or has been marked inactive.', code: 404, clean: true });
                }

                if (team.memberIDs.length < process.env.TEAM_MAX_SIZE) { // Can still join team
                    Team
                        .findOneAndUpdate({
                            code : teamCode.trim()
                        }, {
                            $push : {
                                memberIDs: user._id
                            }
                        }, {
                            new: true
                        })
                        .populate('memberNames')
                        .exec(function(err, newTeam) {
                            if (err || !newTeam) {
                                return callback({ error : 'Unable to join team.', clean: true });
                            }

                            User.findOneAndUpdate({
                                _id : id
                            }, {
                                $set : {
                                    teamCode: newTeam.code
                                }
                            }, {
                                new: true
                            }, function(err, newUser) {
                                if (err || !newUser) {
                                    logger.defaultLogger.error(`Error updating user ${id} while attempting to join team ${newTeam.code}. `, err);
                                    return callback({error : 'Something went wrong.', clean: true });
                                }

                                // Substitutes user objects with their names
                                for (var u in newTeam.memberNames) {
                                    newTeam.memberNames[u] = newTeam.memberNames[u].fullName
                                }

                                // Add new user's name
                                // Not populated yet
                                newTeam.memberNames.push(newUser.fullName);

                                logger.logAction(id, -1, 'Joined the team: ' + newTeam.name + ' (' + newTeam.code + ')', newTeam);
                                return callback(null, newTeam);
                            });
                        });
                } else {
                    return callback({ error : 'Team is full.', code: 400, clean: true });
                }
            });
    });
};

TeamController.leaveTeam = function(id, callback) {

    if (!id) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByID(id, function(err, user) {
        if (err || !user) {
            return callback(err ? err : {error : 'Unable to get user'});
        }

        if (user.teamCode.length == 0) {
            return callback({error : 'You are not in a team.', code: 400, clean: true});
        }

        User.findOneAndUpdate({
            _id : user._id
        }, {
            $set : {
                teamCode : ''
            }
        }, {
            new: true
        }, function(err, newUser) {
            if (err || !newUser) {
                return callback(err ? err : {error: 'Unable to leave team', code: 500});
            }

            Team
                .findOneAndUpdate({
                    code : user.teamCode
                }, {
                    $pull : {
                        memberIDs : user._id
                    }
                }, {
                    new: true
                })
                .select('+memberIDs')
                .exec(function(err, newTeam) {

                    logger.logAction(id, -1, 'Left the team: ' + newTeam.name + ' (' + user.teamCode + ')');

                    if (newTeam && newTeam.memberIDs.length == 0) { // Team is dead, kill it for good
                        Team.findOneAndRemove({
                            _id : newTeam._id
                        }, function(err) {
                            logger.logAction(-1, -1, 'Deleted the team: ' + newTeam.name + ' (' + user.teamCode + ')');
                        });
                    }

                    if (!newTeam) {
                        newTeam.name = 'null';
                    }

                    return callback(null, {message:'Success'})
                });
        })
    });
};

TeamController.getTeam = function(id, callback) {

    if (!id) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    User.getByID(id, function(err, user) {
        if (err || !user) {
            return callback(err ? err : {error : 'Unable to get user'});
        }

        if (!user.teamCode || user.teamCode.length == 0) {
            return callback(null, null);
        }

        Team
            .findOne({
                code : user.teamCode
            })
            .populate('memberNames')
            .exec(function (err, team) {
                if (err || !team) { // Team doesn't exist
                    return callback({ error : 'Team doesn\'t exist', code: 404, clean: true });
                }

                // Substitutes user objects with their names
                for (var u in team.memberNames) {
                    team.memberNames[u] = team.memberNames[u].fullName
                }

                return callback(null, team);
            });
    });
};
TeamController.getByCode = function(code, callback) {

    if (!code) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Team
        .findOne({
            code : code
        })
        .populate('memberNames')
        .exec(function (err, team) {
            if (err || !team) { // Team doesn't exist
                return callback({ error : 'Team doesn\'t exist', code: 404, clean: true });
            }

            // Substitutes user objects with their names
            for (var u in team.memberNames) {
                team.memberNames[u] = {name: team.memberNames[u].fullName, id: team.memberNames[u]._id, status: team.memberNames[u].status}
            }

            return callback(null, team);
        });
};

TeamController.removeFromTeam = function (userExcute, id, code, callback) {
    if (!code || !id) {
        return callback({error: 'Invalid arguments.', code: 400, clean: true})
    }

    User.findOne({
        _id: id
    }, function (err, user) {
        if (err || !user) {
            logger.defaultLogger.error(err)
            return callback({ error : 'User doesn\'t exist.', clean: true });
        }

        if (user.teamCode !== code) {
            return callback({ error : 'The user doesn\'t belong in this team.', clean: true})
        }

        TeamController.leaveTeam(id, function (err, data) {
            if (err || !data) {
                return callback(err);
            }

            logger.logAction(userExcute.id, -1, 'Removed: ' + user.email + 'from team ' + code, 'EXECUTOR IP: ' + userExcute.ip);

            Team.findOne({
                code: code
            }).populate('memberNames')
                .exec(function (err, team) {
                    if (err || !team) {
                        return callback(null, {message : true})
                    } else {
                        return callback(null, {message : false})
                    }
                })
        })
    })
};

TeamController.deleteTeamByCode = function (userExcute, code, callback) {
    if (!code) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }
    Team.findOne({
        code: code
    }, function (err, team) {
        if (err || !team) {
            return callback({ error : 'Team doesn\'t exist', code: 404, clean: true });
        }
        User.updateMany({teamCode: code}, {teamCode: ''}, function (err) {
            Team.findOneAndRemove({
                code: code
            }, function (err) {
                if (err) {
                    logger.defaultLogger.error(`Unable to delete team ${code}. `, err);
                    return callback({error : 'Unable to delete team.', clean: true});
                }
                logger.logAction(userExcute.id, -1, 'Deleted the team: ' + team.name + ' (' + code + ')', 'EXECUTOR IP: ' + userExcute.ip);

                return callback(null, {message : 'Success'})
            });
        });
    });
};

TeamController.getFields = function (userExcute, callback) {
    var fieldsOut = [];
    var current = TeamFields;

    for (var runner in current) {
        if (!TeamFields[runner]['permission'] || TeamFields[runner]['permission'] <= userExecute.permissions.level) {
                fieldsOut.push({'name' : runner, 'type' : TeamFields[runner]['type'].name});
        }
    }

    fieldsOut.push({'name': "memberNames",});

    return callback(null, fieldsOut)
};

TeamController.getByQuery = function (adminUser, query, callback) {

    if (!query || !query.page || !query.size) {
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    var page    = parseInt(query.page);
    var size    = parseInt(query.size);
    var text    = query.text;
    var sort    = query.sort ? query.sort : {};
    var filters = query.filters ? query.filters : {};
    var and     = [];
    var or      = [];
    var appPage = query.appPage ? query.appPage : null;

    if (text) {
        var regex = new RegExp(escapeRegExp(text), 'i'); // filters regex chars, sets to case insensitive

        or.push({ name: regex });
        or.push({ 'memberNames': regex });
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

    logger.defaultLogger.debug("Running query for teams with the following filter(s): ", filters);

    Team.count(filters, function(err, count) {

        if (err) {
            logger.defaultLogger.error(err);
            return callback({error:err.message})
        }

        if (size === 0) {
            size = count
        }

        Team
            .find(filters)
            .sort(sort)
            .skip((page - 1) * size)
            .limit(size)
            .populate('memberNames')
            .exec(function(err, teams) {
                if (err) {
                    logger.defaultLogger.error(err);
                    return callback({error:err.message})
                }

                for (var i = 0; i < teams.length; i++) {
                    teams[i] = TeamController.filterNames(teams[i])
                }

                return callback(null, {
                    teams: teams,
                    totalPages: Math.ceil(count / size),
                    count: count
                })
            });
        });

};

TeamController.filterNames = function (team) {
    // Substitutes user objects with their names
    for (var u in team.memberNames) {
        team.memberNames[u] = [team.memberNames[u].fullName, team.memberNames[u].id]
    }
    return team
};

TeamController.deactivateTeam = function(adminUser, code, callback, log=true){
    // Deactivates the team without removing it
    // The team will retain references to the users but user.teamCode will be erased
    if(log){
        logger.logAction(adminUser._id, -1, "Deactivated a team.", code);
    }
    Team.findOneAndUpdate({code: code}, {
        active: false,
        deactivated: Date.now()
    },
        {
            fields: {"memberIDs": 1},
            new: true
        },
        function(err, team){
        if(err){
            // Do not disassociate team
            return callback(err);
        }

        // Remove the teamCode reference from the user as well.
        for(let member of team.memberIDs){
            User.updateOne(
                {
                    _id: member
                },
                {
                    teamCode: ''
                },
                function(err){
                    if(err){
                        logger.defaultLogger.error(`Error clearing teamCode of ${member}. `, err);
                    }
                });
        }
        return callback(null, "Team deactivation has been queued. Please check the logs for any errors.");
    })

}

TeamController.addPoints = function(adminUser, code, amount, notes, callback) {
    if(!adminUser || !code || amount === null || isNaN(amount) || (amount * 10)%10 !== 0 || !notes){
        return callback({error: "Invalid arguments.", clean: true, code: 400})
    }
    Team.findOne({code: code}).select("memberIDs").exec(function(err, team){
        if(err){
            logger.defaultLogger.error(`Error fetching team while attempting to add points to team ${code}. `, err);
            return callback(err);
        }

        logger.logAction(adminUser._id, -1, "Added points to team.", `Team: ${code} Points: ${amount} Notes: ${notes}`);

        for(let member of team.memberIDs){
            User.addPoints(adminUser, member, amount, notes, function(err, msg) {
                if(err){
                    logger.defaultLogger.error(`Error adding points to user ${member} while attempting to add points to team ${code}. `, err);
                    return;
                }
                logger.logAction(adminUser._id, member, "Added points to user.", `Team: ${code} Points: ${amount} Notes: ${notes}`);
            });
        }
        return callback(null, "Team points awarding queued.");
    })
}

module.exports = TeamController;