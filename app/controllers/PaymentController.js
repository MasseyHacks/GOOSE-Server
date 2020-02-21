const User = require('../models/User')

class PaymentController {
    static async recordUserPayment(paymentMethod) {
        const email = paymentMethod.billing_details.email;
        try {
            await User.findOneAndUpdate({"email": email}, {
                $set: {"status.paid": true}
            })
        } catch (e) {
            return e
        }

    }
}

module.exports = PaymentController;