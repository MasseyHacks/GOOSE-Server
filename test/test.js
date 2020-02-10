const mocha          = require('mocha');
const mongoose       = require('mongoose');
const assert         = require('assert');
const UserController = require('../app/controllers/UserController');
const User           = require('../app/models/User');
const logger         = require('../app/services/logger');
require('dotenv').config();

describe('Database and Mongoose Tests', function () {
    describe("Initial Connection", function () {
        it('should connect successfully', function (done) {
            mongoose.connect('mongodb://localhost:27017/gooseTest', {
                auto_reconnect: true,
                useNewUrlParser: true,
                useFindAndModify: false,
                useCreateIndex: true
            }).then(() => {
                // console.log("DONNEEEEE");
                done()
            }).catch(error => {
                // assert.strictEqual(error, null);
                done(error)
            })
        })
    });

    describe('Initialize settings', function () {
        it('should initialize organizers', function () {
            const organizers      = require('../config/organizers');
        });
        it('should initialize settings', function () {
            const settings        = require('../config/settings');
        })
    });

//     describe('Users', function () {
//         describe('Creating a user', function () {
//             it('should create a user successfully', function (done) {
//                 UserController.createUser('tester@masseyhacks.ca', 'Test', 'User', 'test123', function (error) {
//                     done(error);
//                 })
//             });
//         });
//         describe('Remove user', function () {
//             it('should delete the created user using its email', function (done) {
//                 User.getByEmail('tester@masseyhacks.ca', function (error, user) {
//                     if (!error) {
//                         user.remove();
//                         done();
//                     } else {
//                         done(error);
//                     }
//                 })
//             })
//         })
//     });
    describe('Hardware system', function () {

    });
});

describe('Logging system test', function () {
    it('Winston logger should exist', function (done) {
        if (logger.defaultLogger) {
            done()
        } else {
            done('Winston logger object does not exist')
        }
    })
});



// describe('Cleanup', function () {
//     it('should delete the database', function () {
//         mongoose.connection.db.dropDatabase();
//     })
// });
