const mongoose = require('mongoose')
let fields = {
    checkInTime: {
        type: Number,
        required: true
    },
    checkInUser: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }
}

module.exports = fields;