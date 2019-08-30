require('dotenv').config();

const mongoose  = require('mongoose');
const bcrypt    = require('bcrypt');
const validator = require('validator');
const jwt       = require('jsonwebtoken');
const User      = require('./User');
const TeamFields= require('./data/TeamFields.js');

var schema = new mongoose.Schema(TeamFields);

schema.set('toJSON', {
    virtuals: true
});

schema.set('toObject', {
    virtuals: true
});

schema.virtual('memberNames', {
    ref: 'User',
    localField: 'code',
    foreignField: 'teamCode',
    justOne: false
});

schema.statics.getByCode = function(code, callback) {
    this.findOne({
        code: code
    }, function(err, team) {
        if (err || !team) {
            if (err) {
                return callback(err);
            }

            return callback(err ? err : { error: 'Team not found' })
        }

        return callback(null, team);
    });
};

module.exports = mongoose.model('Team', schema);