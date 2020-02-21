require('dotenv').config();
const express            = require('express');
const logger             = require('../services/logger');
const stripe             = require('stripe')(process.env.STRIPE_SECRET);
const permissions        = require('../services/permissions');
const PaymentController = require('../controllers/PaymentController');

module.exports = function (router) {
    router.use(express.json());

    router.post('/createCheckoutSession', permissions.isVerified, async function (req, res, next) {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    name: 'MasseyHacks VI Event Ticket',
                    description: 'Ticket for general admission.',
                    images: '',
                    amount: 2000,
                    currency: 'cad',
                    quantity: 1
                }
            ],
            success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
        });
        console.log(session);
        res.send({"id": session.id});
    })

    router.post('/webhook', async function (req, res, next) {
        let event;

        try {
            event = req.body;
        } catch (err) {
            res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                // Then define and call a method to handle the successful payment intent.
                // handlePaymentIntentSucceeded(paymentIntent);
                console.log(paymentIntent);
                break;
            case 'payment_method.attached':
                const paymentMethod = event.data.object;
                // Then define and call a method to handle the successful attachment of a PaymentMethod.
                // handlePaymentMethodAttached(paymentMethod);
                console.log(paymentMethod);
                const error = await PaymentController.recordUserPayment(paymentMethod);
                if (error) {
                    return res.status(500).end()
                }
                break;
            // ... handle other event types
            default:
                // Unexpected event type
                return res.status(400).end();
        }

        // Return a response to acknowledge receipt of the event
        res.json({received: true});
    })
};