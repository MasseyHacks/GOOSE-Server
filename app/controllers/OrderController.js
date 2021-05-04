const ShopOrder = require('../models/ShopOrder');
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');

const logger = require('../services/logger');

const OrderController = {}

OrderController.createOrder = function(userExecute, itemID, callback){
    if(!userExecute || !itemID){
        return callback({error: "Invalid arguments.", code: 400, clean:true});
    }

    ShopItem.findOne({
        _id: itemID
    }, function(err, shopItem){
        if(err){
            logger.defaultLogger.error(`Error finding shop item while attempting to create order with item ID ${itemID}. `, err);
            return callback(err);
        }

        if(!shopItem){
            return callback({error: "The requested item does not exist.", code: 404, clean: true});
        }

        User.findOne({
            _id: userExecute._id
        }, function(err, user){
            if(err){
                logger.defaultLogger.error(`Error finding user while attempting to create order with ID ${itemID} for user ${userExecute._id}. `, err);
                return callback(err);
            }

            if(!user){
                return callback({error: "The requested user does not exist.", code: 404, clean: true});
            }

            if(user.points.total < shopItem.price){
                return callback({error: "The user does not have enough points to purchase the item.", code: 401, clean: true});
            }

            if(shopItem.ordersOpen){
                ShopOrder.create({
                    itemID: itemID,
                    itemName: shopItem.name,
                    purchaseUser: userExecute._id,
                    purchaseUserFullName: user.fullName,
                    purchasePrice: shopItem.price,
                    purchaseTime: Date.now()
                }, function(err, shopOrder) {
                    if(err || !shopOrder){
                        logger.defaultLogger.error(`Error creating shop order while attempting to create order with item ID ${itemID} for user ${userExecute._id}. `, err);
                        return callback(err);
                    }

                    ShopItem.updateOne({
                        _id: itemID
                    },{
                        $inc: {
                            'numOrders': 1
                        }
                    }, function(err){
                        if(err){
                            logger.defaultLogger.error(`Error increasing shop item orders while attempting to create order with item ID ${itemID} for user ${userExecute._id}. `, err)
                            return callback(err);
                        }

                        User.addPoints(userExecute, userExecute._id, -shopItem.price, `Shop order. Order ID: ${shopOrder._id}`, function(err){
                            if(err){
                                logger.defaultLogger.error(`Error charging user ${userExecute._id} for order ${shopOrder._id} to buy item ${itemID}`);
                                return callback(err);
                            }

                            return callback(null, {message: `Successfully placed the order. Order ID: ${shopOrder._id}`});
                        })
                    })
                })
            }
            else{
                return callback({error: "The shop item is no longer available for purchase.", code: 401, clean: true})
            }

        })
    })
}

OrderController.fulfillOrder = function(adminUser, orderID, callback){
    if(!adminUser || !orderID){
        return callback({error: "Invalid arguments.", code: 400, clean: true});
    }

    ShopOrder.findOneAndUpdate({
        _id: orderID
    }, {
        $set: {
            status: 'Fulfilled',
            fulfilledTime: Date.now()
        }
    }, {
        new: true
    }, function(err, order){
        if(err || !order){
            logger.defaultLogger.error(`Error updating order while trying to fulfill order ${orderID}. `, err);
            return callback(err);
        }

        return callback(null, order);
    });
}

OrderController.cancelOrder = function(adminUser, orderID, callback){
    if(!adminUser || !orderID){
        return callback({error: "Invalid arguments.", code: 400, clean: true});
    }

    ShopOrder.findOneAndUpdate({
        _id: orderID
    }, {
        $set: {
            status: 'Cancelled'
        }
    }, {
        new: true
    }, function(err, order){
        if(err || !order){
            logger.defaultLogger.error(`Error updating order while trying to cancel order ${orderID}. `, err);
            return callback(err);
        }

        ShopItem.findOneAndUpdate({
            _id: order.itemID
        }, {
            $inc: {
                numOrders: -1
            }
        }, {
            new: true
        }, function(err, shopItem){
            if(err || !shopItem){
                logger.defaultLogger.error(`Error updating order updating the item while trying to cancel order ${orderID}. `, err);
                return callback(err);
            }

            User.addPoints(adminUser, order.purchaseUser, shopItem.price, `Refund for order ${orderID}.`, function(err){
                if(err){
                    logger.defaultLogger.error(`Error refunding points to user ${order.purchaseUser} while attempting to cancel order ${orderID}. `, err);
                    return callback(err);
                }

                return callback(null, {message: "Order cancelled successfully."});
            })
        });

    });
}

OrderController.getOrder = function(userExecute, orderID, callback) {
    let filter = {
        id: orderID
    };

    // only allow admins to query order of other users
    if(!userExecute.permissions.admin){
        filter['purchaseUser'] = userExecute._id;
    }
    ShopOrder.findOne(filter, function(err, order) {
        if(err || !order){
            logger.defaultLogger.error(`Error getting order ID ${orderID}. `, err);
            return callback(err);
        }

        return callback(null, order);
    })
}

OrderController.getOrdersOfItem = function(itemID, callback) {
    ShopOrder.find({
        itemID: itemID
    }, function(err, orders) {
        if(err || !orders){
            logger.defaultLogger.error(`Error getting orders for item ID ${itemID}. `, err);
            return callback(err);
        }

        return callback(null, orders);
    })
}

module.exports = OrderController;