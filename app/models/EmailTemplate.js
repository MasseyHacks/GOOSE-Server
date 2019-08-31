const mongoose = require('mongoose');

let fields = {
    name: String,
    data: Buffer
};

let schema = new mongoose.Schema(fields);
module.exports = mongoose.model('EmailTemplate', schema);