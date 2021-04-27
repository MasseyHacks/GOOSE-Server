const mongoose = require('mongoose');
const fields = require('./data/SubmissionFields');

let schema = new mongoose.Schema(fields);

module.exports = mongoose.model('Submission', schema);