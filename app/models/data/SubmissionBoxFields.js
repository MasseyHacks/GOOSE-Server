let schema = {
    name: {
        type: String,
        required: true
    },
    description: {

    },
    dates: {
        open: {
            type: Number,
            required: true
        },
        close: {
            type: Number,
            required: true
        }
    },
    submissions: {
        type: [String]
    }
}
module.exports = schema;