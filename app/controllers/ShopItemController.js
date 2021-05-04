const ShopItem = require('../models/ShopItem');

const logger = require('../services/logger');

const ShopItemController = {};

ShopItemController.createItem = function(adminUser, name, description, price, maxOrders, ordersOpenTime, ordersCloseTime, callback){
    if(!adminUser || !name || !description || isNaN(price) || isNaN(maxOrders) || isNaN(ordersOpenTime) || isNaN(ordersCloseTime)){
        return callback({error: "Invalid arguments.", code: 400, clean: true})
    }

    ShopItem.create({
        name: name,
        description: description,
        price: price,
        maxOrders: maxOrders,
        ordersOpenTime: ordersOpenTime,
        ordersCloseTime: ordersCloseTime
    }, function(err, shopItem){
        if(err || !shopItem){
            logger.defaultLogger.error(`Error creating shop item. `, err);
            return callback(err);
        }

        logger.logAction(adminUser._id, -1, "Created shop item.", `ID: ${shopItem._id}\nName: ${name}\nDescription: ${description}\nPrice: ${price}\nMax Orders: ${maxOrders}`);
        return callback(null, shopItem);
    })
}

ShopItemController.updateItem = function(adminUser, itemID, newDetails, callback){
    if(!adminUser || !newDetails){
        return callback({error: "Invalid arguments.", code: 400, clean: true})
    }

    ShopItem.findOneAndUpdate({
        _id: itemID
    }, newDetails, {
        new: true
    }, function(err, shopItem){
        if(err || !shopItem){
            logger.defaultLogger.error(`Error updating shop item ${itemID}. `, err);
            return callback(err);
        }

        logger.logAction(adminUser._id, -1, "Updated shop item.", `ID: ${shopItem._id}\nNew name: ${shopItem.name}\nNew description: ${shopItem.description}\nNew price: ${shopItem.price}\nNew max Orders: ${shopItem.maxOrders}`);
        return callback(null, shopItem);
    })
}

ShopItemController.getItems = function(userExecute, callback){
    ShopItem.find({}, function(err, shopItems){
        if(err){
            logger.defaultLogger.error(`Unable to retrieve shop items. `, err);
            return callback(err);
        }

        // Only return items whose orders are open for non-admins
        if(!userExecute.permissions.admin){
            for(let i=shopItems.length-1;i>=0;i--){
                if(!shopItems[i].ordersOpen){
                    shopItems.splice(i, 1);
                }
            }
        }


        return callback(null, {
            shopItems: shopItems
        })
    })
}

ShopItemController.getItem = function(itemID, callback) {
    ShopItem.findOne({
        _id: itemID
    }, function(err, shopItem) {
        if(err || !shopItem) {
            logger.defaultLogger.error(`Error getting details for item ${itemID}. `, err);
            return callback(err);
        }

        return callback(null, shopItem)
    })
}

module.exports = ShopItemController;