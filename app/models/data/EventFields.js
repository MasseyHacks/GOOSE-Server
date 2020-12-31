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
        default: 0
    }
}

let options = {
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
    public: {
        type: Boolean,
        required: true,
        default: false
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
    registeredUsers: {
        type: [String],
        select: false
    },
    checkInData: {
        type: [checkInEntryFields],
        select: false
    },
    options: options,
    dates: dates,
    info: {
        type: String,
        select: false
    }

}

module.exports = schema;