import mongoose from 'mongoose'
import fields from 'data/HardwareFields'

const schema = new mongoose.Schema(fields);

schema.virtual('free').get(() => {
    return this.quantity > 0;
});

module.exports = mongoose.model('Hardware', schema);