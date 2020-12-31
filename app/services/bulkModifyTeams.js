const Team = require('../models/Team');
const TeamController = require('../controllers/TeamController');
const logger = require('./logger');

module.exports = {
    deactivateAll : function(adminUser, callback){
        logger.logAction(adminUser._id, -1, "Initiated a deactivation of all currently active teams.");
        Team.find({
            active: true
        }).select('+memberIDs').exec(function(err, teams){
            if(err){
                return callback({error: "Unable to query teams!", code: 500, clean: true});
            }

            // Iterate through teams that are active
            for (let team of teams) {
                TeamController.deactivateTeam(adminUser, team.code, function(err){
                    if(err){
                        logger.defaultLogger.error(`Unable to deactivate team ${team.code}.`, err);
                    }
                }, false);
            }

            return callback({message: "Team deactivations queued. Check the log for any errors.", code: 200, clean: true});
        })
    }
}