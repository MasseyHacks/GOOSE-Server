const User = require('../models/User');
const Team = require('../models/Team');
const logger = require('./logger');

module.exports = {
    deactivateAll : function(adminUser, callback){
        logger.logAction(adminUser._id, -1, "Deactivated all currently active teams.");
        Team.find({
            active: true
        }).select('+memberIDs').exec(function(err, teams){
            if(err){
                return callback({error: "Unable to query teams!", code: 500});
            }

            // Iterate through teams that are active
            for (let team of teams) {
                Team.updateOne({_id: team.id}, {
                    active: false,
                    deactivated: Date.now()
                }, function(err, info){
                    if(err){
                        logger.logToConsole(`Unable to deactivate team ${team.id}.`, err);
                        // Do not disassociate team
                        return;
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
                                    logger.logToConsole(`Unable to disassociate user ${member} from ${team.id}`, err);
                                }
                            });
                    }
                })
            }
            return callback({message: "Team deactivations queued. Check the log for any errors.", code: 200});
        })

    }
}