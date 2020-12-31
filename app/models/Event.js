const mongoose = require('mongoose');

const fields = require('./data/EventFields');

let schema = new mongoose.Schema(fields);

function checkSameType(typeConstructor, value, strict=false){
    if(value === null || typeof typeConstructor() !== typeof value){
        if(strict){
            return false;
        }

        if(typeof typeConstructor() === 'boolean'){
            return ['true', 'false'].indexOf(value.toLowerCase()) !== -1;
        }

        if(typeof typeConstructor() === 'number'){
            return !isNaN(typeConstructor(value));
        }

        return false;
    }
    return true;
}

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
        toPush[key] = parseInt(newDates[key]);
    }

    if(toPush.registrationClose !== -1 && toPush.registrationClose < toPush.registrationOpen){
        return callback({error: "Registration close is before open.", clean: true, code: 400});
    }

    if(toPush.checkInClose !== -1 && toPush.checkInClose < toPush.checkInOpen){
        return callback({error: "Check in close is before open.", clean: true, code: 400});
    }

    if(toPush.checkInOpen < toPush.registrationOpen){
        return callback({error: "Check in opens before registration.", clean: true, code: 400});
    }
    return callback(null, toPush);
}

schema.statics.validateOptions = function(newOptions, callback) {
    let keys = Object.keys(fields.options);

    let toPush = {}

    for(const key of keys){
        if(newOptions[key] === undefined){
            return callback({error: `Missing setting entry for ${key}.`, clean: true, code: 400})
        }
        if(!checkSameType(fields.options[key]['type'], newOptions[key])){
            return callback({error: `${key} is of incorrect type.`, clean: true, code: 400});
        }

        toPush[key] = newOptions[key];
    }
    return callback(null, toPush);
}

schema.statics.validateMessages = function(newMessages, callback) {
    let keys = Object.keys(fields.messages);

    let toPush = {}

    for(const key of keys){
        if(newMessages[key] === undefined){
            return callback({error: `Missing message entry for ${key}.`, clean: true, code: 400})
        }

        toPush[key] = newMessages[key];
    }
    return callback(null, toPush);
}

schema.set('toJSON', {
    virtuals: true
});

schema.set('toObject', {
    virtuals: true
});

module.exports = mongoose.model('Event', schema);