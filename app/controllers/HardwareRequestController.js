import User from '../models/User'
import Hardware from '../models/Hardware'
import HardwareRequest from '../models/HardwareRequest'
import Logger from '../services/logger'

const HardwareRequestController = {};

HardwareRequestController.submit = function (userID, hardwareID, quantity, callback) {
    Promise.all([User.findById(userID), Hardware.findById(hardwareID)]).then(result => {
        let [user, hardware] = result;
        if (user && hardware && quantity > 0) {
            HardwareRequest.create({
                originUser: userID,
                hardwareID: hardwareID,
                quantity: quantity
            }).then(data => {
                Logger.logAction(userID, -1, `${quantity} ${hardware.name} requested by ${user.fullName}`);
                callback(null, data);
            })
        } else {
            callback('Invalid User or Item', null);
        }
    }).catch(error => callback(error, null))
};

HardwareRequestController.cancel = function (userID, requestID) {

};