require('dotenv').config();

const Settings   = require('../models/Settings');
const User       = require('../models/User');
const mailer     = require('./email');
const logger     = require('../services/logger');
var date         = new Date();

module.exports = {
    flushQueue : function(queue,callback){
        queue = queue.toLowerCase();

        logger.logToConsole('Attempting queue flush');

        //check if the given queue is valid
        if(!queue || validTemplates[queue]['queueName'] === null || !validTemplates[queue]['canQueue']){//invalid
            logger.logToConsole('Invalid email queue!');
            return callback({error: 'Invalid email queue.'});
        }
        else{//valid
            //return all emails from that queue
            Settings.findOne({}, function(err, settings) {
                if(err){
                    return callback({error: 'Cannot find the email queue.'});
                }
                else {
                    logger.logToConsole('Flushing Queue...', settings.emailQueue[validTemplates[queue]['queueName']]);//debug

                    //get pending emails from database
                    var emailPendingList = settings.emailQueue[validTemplates[queue]['queueName']];

                    //Assemble the template
                    let emailHTML = mailer.assembleTemplate(queue);

                    //loop through each
                    emailPendingList.forEach(function (element) {

                        //return user properties and send email
                        User.getByEmail(element, function (error, user) {
                            if (error) {
                                return callback({error: 'The provided email does not correspond to a user.'});
                            }
                            else {
                                //define the dates
                                date.setTime(settings.timeConfirm);
                                let confirmByString = date.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });

                                date.setTime(settings.timeClose);
                                let submitByString = date.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });

                                //fill dataPack
                                var dataPack = {
                                    nickname: user['firstName'],
                                    confirmBy: confirmByString,
                                    dashUrl: process.env.FRONTEND_URL,
                                    submitBy: submitByString
                                };

                                logger.logToConsole(dataPack.dashURL);

                                //send the email
                                mailer.sendTemplateEmail(element, queue, dataPack,emailHTML);

                                var pullObj = {};
                                //kinda sketchy too
                                pullObj['emailQueue.'+validTemplates[queue]['queueName']] = element;
                                //remove it from the queue

                                logger.logToConsole(pullObj);

                                Settings.findOneAndUpdate({}, {
                                    $pull : pullObj
                                }, {

                                }, function(err, settings) {
                                    logger.logToConsole(err, settings.emailQueue);
                                });

                            }

                        })

                    });

					// update the last flush time
					
					var pushObj = {};
					pushObj['emailQueueLastFlushed.'+validTemplates[queue]['queueName']] = Date.now();
					
					Settings.findOneAndUpdate({}, {
						$set: pushObj
					}, {}, function(err, settings){
						if(err){
							logger.logToConsole(err);
						}
					});

                    return callback(null, {message: 'Success'});

                }

            });
        }
    },

    flushQueueUser : function(userEmail,callback){

        logger.logToConsole('Attempting user queue flush');

        Settings.findOne({},function(err,settings){
            if(err){
                return callback(err);
            }
            else{
                User.getByEmail(userEmail, function (err, user) {
                    if(err || !user){
                        return callback({error: 'The provided email does not correspond to a user.'});
                    }

                    //define the dates
                    date.setTime(settings.timeConfirm);
                    let confirmByString = date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });

                    date.setTime(settings.timeClose);
                    let submitByString = date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });

                    //fill dataPack
                    var dataPack = {
                        nickname: user['firstName'],
                        confirmBy: confirmByString,
                        dashUrl: process.env.FRONTEND_URL,
                        submitBy: submitByString
                    };
                    for (var emailQueueName in settings.emailQueue) {
                        if (typeof settings.emailQueue[emailQueueName] === 'object') {
                            //logger.logToConsole(typeof settings.emailQueue[emailQueueName]);
                            for (var i = 0; i < settings.emailQueue[emailQueueName].length; i++) {

                                if (settings.emailQueue[emailQueueName][i] === userEmail) {
                                    logger.logToConsole(emailQueueName + ' ' + settings.emailQueue[emailQueueName][i]);
                                    //mailer
                                    mailer.sendTemplateEmail(userEmail, emailQueueName.toLowerCase(), dataPack);

                                    //delete entry from db
                                    var pullObj = {};
                                    //kinda sketchy too
                                    pullObj['emailQueue.' + emailQueueName] = userEmail;
                                    //remove it from the queue
									
									// update last flush time
									var pushObj = {};
									pushObj['emailQueueLastFlushed.'+emailQueueName] = Date.now();

                                    Settings.findOneAndUpdate({}, {
                                        $pull: pullObj,
										$set: pushObj
                                    }, {}, function (err, settings) {
                                        logger.logToConsole(err, settings.emailQueue);

                                        User.findOneAndUpdate({
                                                email: userEmail
                                            }, {
                                                $push: {
                                                    emailsFlushed: Object.keys(pullObj)[0]
                                                }
                                            }, {},
                                            function (err, user) {

                                                logger.logToConsole(err, user);


                                            });
                                    });
                                }
                            }
                        }
                    }

                    return callback(null,{message: 'Success'});

                });
            }
        });
    }
}