const Event = require('../models/Event');
const logger = require('../services/logger');

let EventController = {};

EventController.createEvent = function(adminUser, name, description, dateTime, callback) {
    if(!adminUser || !name || !description || isNaN(dateTime)){
        return callback({error: 'Invalid arguments.', clean: true, code: 400});
    }

    Event.create({
        name: name,
        description: description,
        'dates.event': dateTime
    }, function(err, event){
        logger.logAction(adminUser._id, -1, "Created an event.", `Name: ${name}\nDescription: ${description}\nDateTime: ${dateTime}`)
        return callback(null, event)
    });
}

EventController.updateEvent = function() {

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