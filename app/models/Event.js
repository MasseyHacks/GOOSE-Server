const mongoose = require('mongoose');

const fields = require('./data/EventFields');

let schema = new mongoose.Schema(fields);

schema.statics.validateDates = function(newDates, callback) {
    let keys = Object.keys(fields.dates);

    let toPush = {}

    for(const key of keys){
        if(newDates[key] === undefined){
            return callback({error: `Missing date entry for ${key}.`, clean: true, code: 400})
        }
        if(isNaN(newDates[key]) || newDates === null){
            return callback({error: `${key} is not a number.`, clean: true, code: 400});
        }
        toPush[key] = newDates[key];
    }
    return callback(null, toPush);
}

module.exports = mongoose.model('Event', schema);