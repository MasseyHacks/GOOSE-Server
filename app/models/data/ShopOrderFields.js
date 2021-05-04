let schema = {
    itemID: {
        type: String,
        required: true
    },
    itemName: { // Just for easy display, not tied to anything else
        type: String,
        required: true
    },
    purchaseUser: {
        type: String,
        required: true
    },
    purchaseUserFullName: {
        type: String,
        required: true
    },
    purchasePrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'Fulfilled', 'Cancelled'],
        required: true,
        default: 'Open'
    },
    purchaseTime: {
        type: Number,
        required: true
    },
    fulfilledTime: {
        type: Number
    }
}

module.exports = schema;