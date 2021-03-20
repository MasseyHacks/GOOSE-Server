let schema = {
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    maxOrders: {
        type: Number,
        required: true,
        default: -1
    },
    numOrders: {
        type: Number,
        required: true,
        default: 0
    },
    ordersOpenTime: {
        type: Number,
        required: true,
        default: 0
    },
    ordersCloseTime: {
        type: Number,
        required: true,
        default: -1
    },
    disabled: {
        type: Boolean,
        required: true,
        default: false
    }
}