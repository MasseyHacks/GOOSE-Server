const Event = require('../models/Event');
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
                'dates': filteredDates
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

EventController.updateOptions = function(adminUser, newOptions, callback){

}

EventController.getRegistered = function(id, callback){

}

EventController.getCheckedIn = function(id, callback){

}

EventController.setPublic = function(adminUser, isPublic, callback){

}

EventController.getFilteredEvents = function() {

}

EventController.getAllEvents = function() {

}

EventController.registerUser = function() {

}

EventController.makePublic = function() {

}

module.exports = EventController;