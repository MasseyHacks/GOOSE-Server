import mongoose from 'mongoose'
import User from './User'
import Hardware from './Hardware'

const schema = new mongoose.Schema({
    originUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hardware'
    },
    quantity: {
        type: Number,
        required: true
    },
    approved: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('HardwareRequest', schema);