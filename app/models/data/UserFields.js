require('dotenv').config();

const mongoose          = require('mongoose');
const bcrypt            = require('bcrypt');
const validator         = require('validator');
const jwt               = require('jsonwebtoken');
const pointsEntryFields = require('./PointsEntryFields');

const UNVERIFIED_HACKER = 0;
const HACKER            = 1;
const CHECK_IN          = 2;
const ADMIN             = 3;
const REVIEW            = 4;
const OWNER             = 5;
const DEVELOPER         = 6;
const INTERNAL          = 99999;

JWT_SECRET = process.env.JWT_SECRET;

let pointsSchema = new mongoose.Schema(pointsEntryFields);

var status = {
    active: {
        type: Boolean,
        required: true,
        default: true,
        caption: "Account Active"
    },
    passwordSuspension: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Suspended until password change"
    },
    submittedApplication: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Submitted Application"
    },
    sentConfirmation: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Confirmation Email Sent"
    },
    waitlisted: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Waitlisted"
    },
    admitted: {
        type: Boolean,
        required: true,
        default: false,
        condition: 'status.statusReleased',
        caption: "Admitted"
    },
    admittedBy: {
        type: String,
        permission: ADMIN,
        caption: "Admitted By"
    },
    confirmed: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Confirmed Invitation"
    },
    paid: {
        type: Boolean,
        required: false,
        default: false,
        caption: "Paid for ticket"
    },
    waiver: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Waiver on File"
    },
    declined: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Declined Invitation"
    },
    noConfirmation: {
        type: Boolean,
        required:true,
        default: false,
        caption: "Failed to Confirm"
    },
    rejected: {
        type: Boolean,
        required: true,
        default: false,
        condition: 'status.statusReleased',
        caption: "Rejected"
    },
    checkedIn: {
        type: Boolean,
        required: true,
        default: false,
        caption: "Checked In"
    },
    checkInTime: {
        type: Number,
        caption: "Time of last checkin",
        time: true
    },
    confirmBy: {
        type: Number,
        condition: 'status.statusReleased',
        caption: "Confirmation Deadline",
        time: true
    },
    statusReleased: {
        type: Boolean,
        default: false,
        permission: ADMIN,
        caption: "Status Released"
    }
};

var hackerApplication = {

    gender: {
        type: String,
        questionType: 'dropdown',
        question: '<b>What gender do you identify as?</b>',
        enum: {
            values: ' |Male|Female|Other|I prefer not to answer'
        },
        mandatory: true,
        precaption: 'BASIC INFORMATION'
    },

    ethnicity: {
        type: String,
        questionType: 'dropdown',
        question: '<b>What is your ethnicity?</b>',
        enum: {
            values: ' |White/Caucasian|Asian/Pacific Islander|Hispanic|African American|Other/multiple ethnicities|I prefer not to answer'
        },
        mandatory: true
    },

    birthday: {
        type: String,
        questionType: 'birthday',
        question: '<b>When is your birthday (YYYY/MM/DD)?</b>',
        maxlength: 10,
        mandatory: true
    },

    shirt: {
        type: String,
        questionType: 'multiradio',
        question: '<b>What is your shirt size?</b>',
        enum: {
            values: 'XS|S|M|L|XL'
        },
        mandatory: true
    },

    hackathonExperience: {
        type: String,
        maxlength: 500,
        questionType: 'fullResponse',
        question: '<b>Which hackathons have you attended? (If any)</b>',
        mandatory: false
    },

    grade: {
        type: String,
        questionType: 'dropdown',
        question: '<b>What grade are you in?</b>',
        enum: {
            values: ' |<9|9|10|11|12'
        },
        mandatory: true
    },

    school: {
        type: String,
        questionType: 'schoolSearch',
        question: '<b>What school do you go to?</b>',
        maxlength: 100,
        mandatory: true
    },


    dietaryRestrictions: {
        type: [String],
        questionType: 'multicheck',
        question: '<b>Please indicate any dietary restrictions.</b>',
        note: 'If your restrictions are not included here, please let us know in the free comment section at the bottom.',
        enum: {
            values: 'Vegetarian|Vegan|Halal|Kosher|Nut Allergy|Gluten Free'
        },
        mandatory: false
    },

    departure: {
        type: String,
        maxlength: 100,
        questionType: 'shortAnswer',
        question: '<b>What city are you travelling from?</b>',
        mandatory: true,
        precaption: 'TRAVEL'
    },

    bus: {
        type: Boolean,
        questionType: 'boolean',
        question: '<b>Will you be travelling on our Toronto/Waterloo bus? (If funding permits)</b>',
        mandatory: true
    },

    reimbursement: {
        type: Boolean,
        questionType: 'boolean',
        question: '<b>Do you need travel reimbursement? (If funding permits)</b>',
        mandatory: true
    },

    github: {
        type: String,
        maxlength: 100,
        questionType: 'shortAnswer',
        question: '<b>GitHub</b>',
        mandatory: false,
        precaption: 'EXPERIENCE'
    },

    devpost: {
        type: String,
        maxlength: 100,
        questionType: 'shortAnswer',
        question: '<b>Devpost</b>',
        mandatory: false
    },

    website: {
        type: String,
        maxlength: 100,
        questionType: 'shortAnswer',
        question: '<b>Personal Website</b>',
        mandatory: false
    },

    resume: {
        type: String,
        maxlength: 100,
        questionType: 'shortAnswer',
        question: '<b>Link to resume</b>',
        mandatory: false
    },

    fullResponse1: {
        type: String,
        maxlength: 1500,
        questionType: 'fullResponse',
        question: '<b>Tell us about a recent project you worked on, computer science-related or not. (ie. Organizing an event, side projects, making art, leading a club, etc.) It’ll help give us an idea of your skills and what you’re all about. (Two sentence minimum)</b>',
        mandatory: true
    },

    fullResponse2: {
        type: String,
        maxlength: 1500,
        questionType: 'fullResponse',
        question: '<b>Why do you want to attend MasseyHacks? (Two sentence minimum)</b>',
        mandatory: true
    },

    phoneNumber: {
        type: String,
        questionType: 'phoneNumber',
        question: '<b>What is your phone number?</b>',
        maxlength: 11,
        mandatory: false,
        precaption: 'FINAL QUESTIONS'
    },

    discovery: {
        type: String,
        questionType: 'dropdown',
        question: '<b>How did you find us?</b>',
        enum: {
            values: ' |MLH|Social Media|Word of mouth|Other'
        },
        mandatory: true,

    },

    codeOfConduct: {
        type: Boolean,
        questionType: 'contract',
        question: '<b>I have read and agree to the <a href="https://static.mlh.io/docs/mlh-code-of-conduct.pdf" target="_blank">MLH Code of Conduct</a>.</b>',
        reviewerText: '<b>I have read and agree to the MLH Code of Conduct.</b>',
        mandatory: true,
        warning: 'You must agree to the MLH Code of Conduct.'
    },

    termsAndConditions: {
        type: Boolean,
        questionType: 'contract',
        question: '<b>I authorize you to share my application/registration information for event administration, ranking, MLH administration, pre- and post-event informational e-mails, and occasional messages about hackathons in-line with the <a href="https://mlh.io/privacy" target="_blank">MLH Privacy Policy</a>. I agree to the terms of both the <a href="https://github.com/MLH/mlh-policies/tree/master/prize-terms-and-conditions" target="_blank">MLH Contest Terms and Conditions</a> and the <a href="https://mlh.io/privacy" target="_blank">MLH Privacy Policy</a>.</b>',
        mandatory: true,
        reviewerText: '<b>I have read and agree to the MLH Contest Terms and data-sharing policy.</b>',
        warning: 'You must agree to the MLH Contest Terms and Conditions and data-sharing policy.'
    },


    tabsOrSpaces: {
        type: String,
        questionType: 'multiradio',
        question: '<b>Tabs or spaces?</b>',
        enum: {
            values: 'Tabs|Spaces'
        },
        mandatory: false
    },

    comment: {
        type: String,
        maxlength: 1500,
        questionType: 'fullResponse',
        question: '<b>Anything else you want to let us know?</b>',
        mandatory: false,
        precaption: 'FREE COMMENT'
    }
};

var mentorApplication = {

};

var workshopHost = {

};

var confirmation = {
    // bus: {
    //     type: Boolean,
    //     questionType: 'boolean',
    //     question: 'Will you be travelling on our Toronto/Waterloo bus?',
    //     mandatory: true,
    //     precaption: 'TRANSPORTATION'
    // },

    additionalNotes: {
        type: String,
        questionType: 'fullResponse',
        question: 'Is there anything else you\'d like us to know?',
        mandatory: false,
        precaption: 'ADDITIONAL NOTES'
    }
};

var profile = {
    hacker: hackerApplication,
    mentor: mentorApplication,
    workshop: workshopHost,
    confirmation: confirmation,
    signature: {
        type: Number,
        default: -1
    }
};

var userType = {
    hacker : {
        type: Boolean,
        required: true,
        default: true
    },
    mentor: {
        type: Boolean,
        required: true,
        default: false
    },
    workshopHost: {
        type: Boolean,
        required: true,
        default: false
    }
};

var permissions = {
    verified : {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 1
    },
    checkin: {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 2
    },
    admin: {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 3
    },
    reviewer: {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 4
    },
    owner: {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 5
    },
    developer: {
        type: Boolean,
        required: true,
        default: false,
        permissionLevel: 6
    }
};

var schema = {

    firstName: {
        type: String,
        required: true,
        maxlength: 50,
        caption: "First Name"
    },

    lastName: {
        type: String,
        required: true,
        maxlength: 50,
        caption: "Last Name"
    },

    email: {
        type: String,
        required: true,
        maxlength: 50,
        validate: [
            validator.isEmail,
            'Invalid Email'
        ],
        caption: "Email"
    },

    password: {
        type: String,
        required: true,
        select: false,
        permission: INTERNAL
    },

    magicJWT: {
        type: String,
        select: false,
        permission: INTERNAL
    },

    timestamp: {
        type: Number,
        required: true,
        default: 0,
        caption: "Creation Time",
        time: true
    },

    lastUpdated: {
        type: Number,
        default: 0,
        caption: "Profile Last Updated",
        time: true
    },

    confirmedTimestamp: {
        type: Number,
        default: 0,
        caption: "Confirmation Last Updated",
        time: true
    },

    passwordLastUpdated: {
        type: Number,
        default: 0,
        caption: "Password Last Updated",
        time: true
    },

    teamCode: {
        type: String,
        min: 0,
        maxlength: 140,
        caption: "Team Code"
    },

    applicationAdmit: {
        type: [String],
        permission: OWNER,
        caption: "Votes to Admit"
    },

    applicationReject: {
        type: [String],
        permission: OWNER,
        caption: "Votes to Reject"
    },

    applicationVotes: {
        type: [String],
        permission: ADMIN,
        caption: "Application Votes"
    },

    emailsFlushed: {
        type: [String],
        permission: ADMIN,
        caption: "Emails Flushed from Queue"
    },

    numVotes : {
        type: Number,
        default: 0,
        permission: ADMIN,
        caption: "Number of Votes"
    },

    skillRequest : {
        type: Number,
        default: 0,
        permission: ADMIN,
        caption: "Number of skill questions requested"
    },
    skillPass : {
        type: Number,
        default: 0,
        permission: ADMIN,
        caption: "Number of skill questions passed"
    },
    skillFail : {
        type: Number,
        default: 0,
        permission: ADMIN,
        caption: "Number of skill questions failed"
    },
    status: status,
    permissions : permissions,
    userType: userType,

    // Only parts user can update
    profile: profile,
    points: {
        history : {
            type: [pointsEntryFields]
        }
    }
};

module.exports = schema;
