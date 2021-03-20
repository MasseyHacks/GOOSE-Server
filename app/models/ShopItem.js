const mongoose = require('mongoose');

const fields = require('./data/ShopItemFields');

let schema = new mongoose.Schema(fields);

schema.virtual('ordersOpen').get(function() {
    if(this.disabled){
        return false;
    }

    if(this.ordersOpenTime > Date.now()){
        return false;
    }

    if(this.ordersCloseTime !== -1 && this.ordersCloseTime < Date.now()){
        return false;
    }

    if(this.maxOrders === -1){
        return true;
    }

    return this.numOrders < this.maxOrders;

});

schema.set('toJSON', {
    virtuals: true
});

schema.set('toObject', {
    virtuals: true
});


module.exports = mongoose.model('ShopItem', schema);