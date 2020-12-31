const Event = require('../models/Event');
const User = require('../models/User');
const logger = require('../services/logger');

let EventController = {};

EventController.createEvent = function(adminUser, name, description, dateTime, callback) {
    if(!adminUser || !name || !description || dateTime === null || isNaN(dateTime)){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Event.create({
        name: name,
        description: description,
        'dates.event': dateTime
    }, function(err, event){
        if(err){
            logger.defaultLogger.error(`Error while creating event ${name}. `, err);
            return callback(err);
        }
        logger.logAction(adminUser._id, -1, "Created an event.", `Name: ${name}\nDescription: ${description}\nDateTime: ${dateTime}`)
        return callback(null, event)
    });
}

EventController.updateDates = function(adminUser, id, newDates, callback) {
    if(!adminUser || !id || !newDates){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Event.validateDates(newDates, function(err, filteredDates){
        if(err){
            logger.defaultLogger.error(`Error validating new dates while attempting to update event dates. `, err);
            return callback(err);
        }
        Event.findOneAndUpdate({
            _id: id
        }, {
            $set: {
                dates: filteredDates
            }
        }, {
            new: true
        }, function(err, event){
            if(err){
                logger.defaultLogger.error('Error updating event dates while attempting to update event dates. ', err);
                return callback(err);
            }
            return callback(null, event);
        })

    });
}

EventController.updateOptions = function(adminUser, id, newOptions, callback){
    if(!adminUser || !id || !newOptions){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Event.validateOptions(newOptions, function(err, filteredOptions){
        if(err){
            logger.defaultLogger.error(`Error validating new options while attempting to update event dates. `, err);
            return callback(err);
        }
        logger.defaultLogger.silly(filteredOptions);
        Event.findOneAndUpdate({
            _id: id
        }, {
            $set: {
                options: filteredOptions
            }
        }, {
            new: true
        }, function(err, event){
            if(err){
                logger.defaultLogger.error('Error updating event options while attempting to update event options. ', err);
                return callback(err);
            }
            return callback(null, event);
        })
    })
}

EventController.getRegistered = function(id, callback){

}

EventController.getCheckedIn = function(id, callback){

}

EventController.getFilteredEvents = function(userExecute, callback) {
    if(!userExecute){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }

    Event.find({}).select('+registeredUsers').exec(function(err,events){
        if(err) {
            logger.defaultLogger.error(`Error querying event while attempting to get filtered events. `, err);
            return callback(err);
        }

        // if admin: don't care
        // if normal user:
        // - hide events that registration has not yet opened
        // - hide events that user is not registered for that registration has closed
        // - hide events that are not public that the user is not registered for

        if(userExecute.permissions.admin){
            return callback(null, events);
        }

        let eventsR = []

        // normal user
        for (let i = 0; i<events.length;i++){
            const eventInfo = events[i];

            // check if user is in registered users, if so always return
            if(eventInfo.registeredUsers.indexOf(userExecute._id) === -1){
                // check if event is public
                if(!eventInfo.options.public){
                    continue;
                }

                // check if registration has opened
                if(eventInfo.dates.registrationOpen > Date.now()){
                    continue;
                }

                // check if registration is closed
                if(eventInfo.dates.registrationClose !== -1 && eventInfo.dates.registrationClose < Date.now()){
                    continue;
                }
            }

            eventsR.push(eventInfo.toObject());
            delete eventsR[eventsR.length-1].registeredUsers;
        }

        return callback(null, eventsR);
    })
}

EventController.checkInUser = function(userExecute, userID, eventID, callback){
    // if normal user:
    // - do not allow check in to a non-public event that user is not registered for
    // - do not allow check in to an event that requires registration before check in
    // - do not allow check in to an event with check in closed
    if(!userExecute || !userID || !eventID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }

    if(userExecute._id.toString() !== userID && !userExecute.permissions.admin){
        return callback({error: "You cannot check in that user.", clean: true, code: 403})
    }

    Event.findOne({
        _id: eventID,
        checkInData: {
            $not: {
                $elemMatch: {
                    checkedInUser: userID
                }
            }

        }
    }).select('+registeredUsers +checkInData').exec(function(err, event){
        if(err){
            logger.defaultLogger.error(`Error querying event while attempting to check in user to event. `, err);
            return callback(err);
        }

        if(!event){
            return callback({error: "The given event does not exist or you have already checked in to it.", clean: true, code: 400});
        }

        logger.defaultLogger.silly(event)

        if(event.registeredUsers.indexOf(userID) === -1) {
            if(!event.options.public){
                return callback({error: "The given event does not exist or you have already checked in to it.", clean: true, code: 400});
            }
            if(event.options.mustRegisterBeforeCheckIn){
                return callback({error: "You must register for this event before checking in.", clean: true, code: 400});
            }
        }

        // check if check in has started
        if(event.dates.checkInOpen > Date.now()){
            return callback({error: "Check in for this event has not yet started.", clean: true, code: 400});
        }

        if(event.dates.checkInClose !== -1 && event.dates.checkInClose < Date.now()){
            return callback({error: "Check in for this event has ended.", clean: true, code: 400});
        }

        // update checked in as well as registration, if user did not register yet
        let queryObj = {
            $push: {
                checkInData: {checkInTime: Date.now(), checkedInUser: userID}
            }
        }

        if(event.registeredUsers.indexOf(userID) === -1){
            queryObj["$push"]["registeredUsers"] = userID
        }

        Event.updateOne({_id: eventID}, queryObj, function(err, msg){
            if(err){
                logger.defaultLogger.error(`There was an error updating the event ${eventID} while attempting to check in user ${userID}. `, err);
                return callback(err);
            }

            // update checked in as well as registration, if user did not register yet
            let queryObj = {
                $push: {
                    'events.checkedIn': eventID
                }
            }

            if(event.registeredUsers.indexOf(userID) === -1){
                queryObj["$push"]["events"]["registered"] = userID
            }

            // update the user as well
            User.updateOne({_id: userID}, queryObj, function(err, user){
                if(err){
                    logger.defaultLogger.error(`There was an error updating the user while attempting to check in user ${userID} to event ${eventID}. `, err);
                    return callback(err);
                }

                return callback(null, {message: "Checked in to event successfully."});
            })

        })
    });
}

EventController.registerUser = function(userExecute, userID, eventID, callback) {

}

EventController.getAllEvents = function(callback) {
    Event.find({}, function(err, events){
        if(err){
            logger.defaultLogger.error("Error retrieving all events. ", err);
            return callback(err)
        }
        return callback(null, events);
    });
}

module.exports = EventController;