let schema = {
    amount: {
        type: Number,
        required: true
    },
    awardedBy: {
        type: String,
        required: true
    },
    notes: {
        type: String
    }
}

module.exports = schema;