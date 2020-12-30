const mongoose = require('mongoose');

const fields = require('./data/EventFields');

let schema = new mongoose.Schema(fields);

module.exports = mongoose.model('Event', schema);