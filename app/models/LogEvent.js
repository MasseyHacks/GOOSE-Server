const mongoose = require('mongoose');
const User     = require('./User');

JWT_SECRET = process.env.JWT_SECRET;

var loggingTemplate = {
    ID : {
        type: String,
        required: true
    },
    name : {
        type: String
    },
    email : {
        type: String
    }
};

var schema = new mongoose.Schema({
    timestamp : {
        type: Number,
        required: true
    },
    from : loggingTemplate,
    to : loggingTemplate,
    message : {
        type: String,
        required: true
    },
    detailedMessage : {
        type: String
    }
});

schema.set('toJSON', {
    virtuals: true
});

schema.set('toObject', {
    virtuals: true
});

schema.statics.getLoggingTemplate = function() {
    return loggingTemplate
};

schema.virtual('fromUser', {
    ref: 'User',
    localField: 'from.ID',
    foreignField: '_id',
    justOne: true
});

schema.virtual('toUser', {
    ref: 'User',
    localField: 'to.ID',
    foreignField: '_id',
    justOne: true
});

schema.virtual('timestampHuman').get(function() {
    return new Date(this.timestamp)
});

module.exports = mongoose.model('LogEvent', schema);