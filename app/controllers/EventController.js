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
            logger.logAction(adminUser._id, -1, "Modified event dates.",`Event ID: ${id}`)
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
            logger.logAction(adminUser._id, -1, "Modified event options.",`Event ID: ${id}`)
            return callback(null, event);
        })
    })
}

EventController.updateDetails = function(adminUser, id, newName, newDescription, callback){
    if(!adminUser || !id || !newName || !newDescription){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    if(newName.trim() === "" || newDescription.trim() === ""){
        return callback({error: 'Event name and description cannot be blank.', clean: true, code: 400})
    }

    Event.findOneAndUpdate({
        _id: id
    }, {
        $set: {
            name: newName,
            description: newDescription
        }
    }, {
        new: true
    }, function(err, event){
        if(err){
            logger.defaultLogger.error('Error updating event details while attempting to update event details. ', err);
            return callback(err);
        }
        logger.logAction(adminUser._id, -1, "Modified event details.",`Event ID: ${id}`)
        return callback(null, event);
    })
}

EventController.updateMessages = function(adminUser, id, newMessages, callback){
    if(!adminUser || !id || !newMessages){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Event.validateMessages(newMessages, function(err, filteredMessages){
        if(err){
            logger.defaultLogger.error(`Error validating new messages while attempting to update event messages. `, err);
            return callback(err);
        }

        Event.findOneAndUpdate({
            _id: id
        }, {
            $set: {
                messages: filteredMessages
            }
        }, {
            new: true
        }, function(err, event){
            if(err){
                logger.defaultLogger.error('Error updating event messages while attempting to update event messages. ', err);
                return callback(err);
            }
            logger.logAction(adminUser._id, -1, "Modified event messages.",`Event ID: ${id}`)
            return callback(null, event);
        })
    })
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

                logger.logAction(userExecute._id, userID, "Checked in user to event.",`Event ID: ${eventID}`)
                return callback(null, {message: "Checked in to event successfully."});
            })

        })
    });
}

EventController.registerUser = function(userExecute, userID, eventID, callback) {
    // if normal user:
    // - do not allow check in to a non-public event that user is not registered for
    // - do not allow check in to an event that requires registration before check in
    // - do not allow check in to an event with check in closed
    if(!userExecute || !userID || !eventID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }

    if(userExecute._id.toString() !== userID && !userExecute.permissions.admin){
        return callback({error: "You cannot register that user.", clean: true, code: 403})
    }

    Event.findOne({
        _id: eventID,
        registeredUsers: {
            $not: {
                $elemMatch: {
                    $eq: userID
                }
            }

        }
    }).exec(function(err, event){
        if(err){
            logger.defaultLogger.error(`Error querying event while attempting to register user for event. `, err);
            return callback(err);
        }

        if(!event){
            return callback({error: "The given event does not exist or you have already registered for it.", clean: true, code: 400});
        }

        logger.defaultLogger.silly(event)

        // note: don't need to check if event is public as it requires an event ID as argument

        // check if registration has started
        if(event.dates.registrationOpen > Date.now()){
            return callback({error: "Check in for this event has not yet started.", clean: true, code: 400});
        }

        if(event.dates.registrationClose !== -1 && event.dates.registrationClose < Date.now()){
            return callback({error: "Check in for this event has ended.", clean: true, code: 400});
        }

        Event.updateOne({_id: eventID}, {
            $push: {
                registeredUsers: userID
            }
        }, function(err, msg){
            if(err){
                logger.defaultLogger.error(`There was an error updating the event ${eventID} while attempting to register user ${userID}. `, err);
                return callback(err);
            }

            // update the user as well
            User.updateOne({_id: userID}, {
                $push: {
                    'events.registered': eventID
                }
            }, function(err, user){
                if(err){
                    logger.defaultLogger.error(`There was an error updating the user while attempting to register user ${userID} for event ${eventID}. `, err);
                    return callback(err);
                }

                logger.logAction(userExecute._id, userID, "Registered user for event.",`Event ID: ${eventID}`)
                return callback(null, {message: "Registered for event successfully."});
            })

        })
    });
}

EventController.unregisterUser = function(userExecute, userID, eventID, callback){
    if(!userExecute || !userID || !eventID){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }

    if(userExecute._id.toString() !== userID && !userExecute.permissions.admin){
        return callback({error: "You cannot unregister that user.", clean: true, code: 403})
    }

    Event.findOne({
        _id: eventID,
        registeredUsers: {
            $elemMatch: {
                $eq: userID
            }
        },
        checkInData: {
            $not: {
                $elemMatch: {
                    checkedInUser: userID
                }
            }
        }
    }).select('+checkInData').exec(function(err, event){
        if(err){
            logger.defaultLogger.error(`Error querying event while attempting to unregister user from event. `, err);
            return callback(err);
        }

        if(!event){
            return callback({error: "The given event does not exist or you have not registered for it or you have already checked in to it.", clean: true, code: 400});
        }

        logger.defaultLogger.silly(event)

        Event.updateOne({_id: eventID}, {
            $pull: {
                registeredUsers: userID
            }
        }, function(err, msg){
            if(err){
                logger.defaultLogger.error(`There was an error updating the event ${eventID} while attempting to unregister user ${userID}. `, err);
                return callback(err);
            }

            // update the user as well
            User.updateOne({_id: userID}, {
                $pull: {
                    'events.registered': eventID
                }
            }, function(err, user){
                if(err){
                    logger.defaultLogger.error(`There was an error updating the user while attempting to unregister user ${userID} from event ${eventID}. `, err);
                    return callback(err);
                }

                logger.logAction(userExecute._id, userID, "Unregistered user from event.",`Event ID: ${eventID}`)
                return callback(null, {message: "Unregistered from event successfully."});
            })

        })
    });
}

EventController.getMessages = function(userExecute, id, callback){
    if(!userExecute || !id){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }
    Event.findOne({
        _id: id
    }).select('messages.registered messages.checkedIn checkInData registeredUsers').exec(function(err, event){
        if(err){
            logger.defaultLogger.error(`Error querying event messages for ${id}. `, err);
            return callback(err);
        }

        if(!event){
            return callback({error: "The given event does not exist or you do not have permission to view its messages."});
        }

        // admin gets all messages
        if(userExecute.permissions.admin){
            return callback(null, event.messages);
        }

        let rMessages = {}

        // check if user is registered
        if(event.registeredUsers.indexOf(userExecute._id) !== -1){
            rMessages["registered"] = event.messages.registered;
        }

        // check if user is checked in
        let found = false;
        for(const entry of event.checkInData){
            logger.defaultLogger.silly(entry);
            if(entry.checkedInUser === userExecute._id.toString()){
                found = true;
            }
        }

        if(found){
            rMessages["checkedIn"] = event.messages.checkedIn;
        }

        if(Object.keys(rMessages).length === 0){
            return callback({error: "The given event does not exist or you do not have permission to view its messages."});
        }

        return callback(null, rMessages);
    })
}

EventController.getRegistered = function(adminUser, id, callback){

}

EventController.getCheckedIn = function(adminUser, id, callback){

}

EventController.awardPointsToRegistered = function(adminUser, eventID, callback){

}

EventController.awardPointsToCheckedIn = function(adminUser, eventID, callback){

}

EventController.getAllEvents = function(callback) {
    Event.find({}).select('+registeredUsers +checkInData').exec(function(err, events){
        if(err){
            logger.defaultLogger.error("Error retrieving all events. ", err);
            return callback(err)
        }
        return callback(null, events);
    });
}

EventController.getByID = function(userExecute, id, callback){
    if(!userExecute || !id){
        return callback({error: 'Invalid arguments.', clean: true, code: 400})
    }
    let selectProjection = '';
    if(userExecute.permissions.admin){
        selectProjection = '+registeredUsers +checkInData +messages.registered +messages.checkedIn';
    }

    Event.findOne({
        _id: id
    }).select(selectProjection).exec(function(err, event){
        if(err){
            logger.defaultLogger.error(`Error retrieving event ${id}. `, err);
            return callback(err);
        }

        if(!event){
            return callback({error: "No event with the given ID exists.", code: 400, clean: true})
        }

        return callback(null, event);
    })
}

module.exports = EventController;