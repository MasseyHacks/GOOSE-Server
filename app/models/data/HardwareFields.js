const schema = {
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        default: 0,
        required: true
    },
    category: {
        type: String,
    },
    image: {
        type: String,
    },
    description: {
        type: String
    },
    itemType: {
        type: String,
        enum: ['free', 'checkout', 'lottery']
    }
};

module.exports = schema;