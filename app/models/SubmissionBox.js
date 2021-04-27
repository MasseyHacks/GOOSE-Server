const mongoose = require('mongoose');
const fields = require('./data/SubmissionBoxFields');

let schema = new mongoose.Schema(fields);

module.exports = mongoose.model('SubmissionBox', schema);