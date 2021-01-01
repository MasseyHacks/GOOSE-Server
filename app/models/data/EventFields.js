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
    },
    finished: {
        type: Number,
        required: true,
        default: -1
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
    },
    checkInCodeRequired: {
        type: String,
        required: true,
        default: true
    },
    checkInCode: {
        type: String,
        select: false,
        required: true,
        default: ""
    }
}

// make sure to update the projection in EventController.getByID after adding a new message
let messages = {
    registered: {
        type: String,
        select: false,
        required: true,
        default: "You are registered!"
    },
    checkedIn: {
        type: String,
        select: false,
        required: true,
        default: "You are checked in!"
    },
    finished: {
        type: String,
        select: false,
        required: true,
        default: "Thanks for participating!"
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
    messages: messages
}

module.exports = schema;