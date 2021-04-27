let schema = {
    userID: {
        type: String,
        required: true
    },
    submissionBoxID: {
        type: String,
        required: true
    },
    submissionBoxName: {
        type: String,
        required: true
    },
    submitTime: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    files: {
        type: [String],
        required: true
    }
}
module.exports = schema;