const fs             = require('fs');
const User           = require('../app/models/User');
const UserController = require('../app/controllers/UserController');
const mailer         = require('../app/services/email');
const organizers     = JSON.parse(fs.readFileSync('config/data/organizers.json', 'utf8'));
const logger         = require('../app/services/logger');

logger.defaultLogger.info("Trying to add organizers.");

for(const key in organizers) {
    email      = organizers[key]['email'];
    firstName  = organizers[key]['firstName'];
    lastName   = organizers[key]['lastName'];
    permission = organizers[key]['permission'];

    makeOrganizer(email, firstName, lastName, permission);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeOrganizer(email, firstName, lastName,  permission) {
        User.getByEmail(email, async function (err, user) {
            if (!user) {
                logger.logConsoleDebug('Adding: ', email, firstName, lastName, permission);

                var password = "";
                var suspension = true;

                if (process.env.NODE_ENV === 'development') {
                    password = "123456";
                    suspension = false;
                }
                console.log("STOP MOGNO");
                await sleep(3000);
                User.create({
                    'email': email,
                    'firstName': firstName,
                    'lastName': lastName,
                    'password': User.generateHash(password),
                    'status.passwordSuspension': suspension,
                    'status.admitted': true,
                    'status.confirmed': true,
                    'status.submittedApplication': true,
                    'status.waiver': true,
                    'status.statusReleased': true,
                    'status.timestamp': Date.now(),
                    'status.admittedBy': 'MasseyHacks Internal Authority',
                    'verified': true
                }, function (err, userNew) {

                    if (err) throw err;

                    userNew.setPermission(permission);

                    if (userNew.permissions.developer) {
                        var token = userNew.generateMagicToken();
                        User.findOneAndUpdate({
                                _id: userNew.id
                            },
                            {
                                $set: {
                                    'magicJWT': token
                                }
                            },
                            {
                                new: true
                            }, function (err, user) {
                                logger.logConsoleDebug(userNew.email + ': ' + process.env.FRONTEND_URL + '/magic?token=' + token);
                                //send the email
                                if (process.env.NODE_ENV !== 'development') {
                                    mailer.sendTemplateEmail(user.email, 'magiclinkemails', {
                                        nickname: userNew.firstName,
                                        magicURL: process.env.FRONTEND_URL + '/magic?token=' + token,
                                        ip: 'MH INTERNAL'
                                    });
                                }
                            })
                    }

                    if (process.env.NODE_ENV !== 'development') {
                        UserController.sendPasswordResetEmail(email, function (err) {
                            if (err) {
                                logger.defaultLogger.error("Error sending initial organizer password reset email. ", err);
                            } else {
                                logger.defaultLogger.debug('Initial organizer password reset email sent successfully.');
                            }
                        });
                    }
                });
            }
        });
}