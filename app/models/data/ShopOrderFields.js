let schema = {
    itemID: {
        type: String,
        required: true
    },
    purchaseUser: {
        type: String,
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