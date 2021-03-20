const mongoose = require('mongoose');

const fields = require('./data/ShopOrderFields');

let schema = new mongoose.Schema(fields);

module.exports = schema;