const mongoose = require('mongoose')
const checkInEntryFields = require('./CheckInEntryFields')
let dates = {
    registrationOpen: {
        type: Number,
        required: true,
        default: 0
    },
    registrationClose: {
        type: Number,
        required: true,
        default: -1
    },
    checkInOpen: {
        type: Number,
        required: true,
        default: 0
    },
    checkInClose: {
        type: Number,
        required: true,
        default: -1
    },
    event: {
        type: Number,
        required: true,
        default: -1
    }
}

let schema = {
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    maxRegistrations: {
        type: Number,
        required: true,
        default: -1
    },
    mustRegisterBeforeCheckIn: {
        type: Boolean,
        required: true,
        default: true
    },
    registeredUsers: {
        type: [mongoose.Schema.Types.ObjectId]
    },
    checkInData: {
        type: [checkInEntryFields]
    },
    public: {
        type: Boolean,
        required: true,
        default: true
    },
    dates: dates

}

module.exports = schema;