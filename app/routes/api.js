const jwt                = require('jsonwebtoken');
const validator          = require('validator');
const express            = require('express');
const mongodb            = require('mongodb');
const fs                 = require('fs');
const formidable         = require('formidable');
const path               = require('path');

const GridStore             = require('../models/GridStore');
const User               = require('../models/User');
const UserFields         = require('../models/data/UserFields');
const Settings           = require('../models/Settings');
const LogEvent           = require('../models/LogEvent');
const UserController     = require('../controllers/UserController');
const TeamController     = require('../controllers/TeamController');
const SettingsController = require('../controllers/SettingsController');
const EventController    = require('../controllers/EventController');
const ShopItemController = require('../controllers/ShopItemController');
const OrderController    = require('../controllers/OrderController');
const SubmissionsController = require('../controllers/SubmissionsController');
const globalUsersManager  = require('../services/globalUsersManager');

const permissions        = require('../services/permissions');
const logger             = require('../services/logger');
const mailer             = require('../services/email');
const stats              = require('../services/stats');
const bulkModifyTeams    = require('../services/bulkModifyTeams');

const multer = require('multer');


require('dotenv').config();

JWT_SECRET             = process.env.JWT_SECRET;

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let diskPath = path.join(__dirname, '..', '..', 'uploads', req.body.submissionBoxID, req.userExecute._id.toString());
        fs.mkdirSync(diskPath, {
            recursive: true
        })
        cb(null, diskPath)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname + '-' + Date.now())
    }
})

const upload = multer({storage: storage})

module.exports = function(router) {
    router.use(express.json());

    // Admin
    // Get submission box submissions
    router.get('/getSubmissionBoxSubmissions', permissions.isAdmin, function(req, res) {
        SubmissionsController.getSubmissionBoxSubmissions(req.query.submissionBoxID, logger.defaultResponse(req, res));
    })

    // Admin
    // Remove submission box
    router.post('/removeSubmissionBox', permissions.isAdmin, function(req, res){
        SubmissionsController.removeSubmissionBox(req.body.submissionBoxID, logger.defaultResponse(req, res));
    })

    // Admin
    // Update submission box
    router.post('/updateSubmissionBox', permissions.isAdmin, function(req, res){
        SubmissionsController.updateSubmissionBox(req.body.submissionBoxID, req.body.name, req.body.description, req.body.openDate, req.body.closeDate, logger.defaultResponse(req, res));
    })

    // Admin
    // Create submission box
    router.post('/createSubmissionBox', permissions.isAdmin, function(req, res){
        SubmissionsController.createSubmissionBox(req.body.name, req.body.description, req.body.openDate, req.body.closeDate, logger.defaultResponse(req, res));
    })

    // Admin
    // Confirm for user
    router.post('/adminAcceptInvitation', permissions.isAdmin, function(req, res) {
        var confirmation = req.body.confirmation;
        let userID = req.body.userID;

        UserController.acceptInvitation({
            _id: userID
        }, confirmation, logger.defaultResponse(req, res));
    });

    // Admin
    // Associate user with Discord ID
    router.post('/associateDiscord', permissions.isAdmin, function(req, res){
        UserController.associateDiscordID(req.userExecute, req.body.userID, req.body.discordID, logger.defaultResponse(req, res));
    })

    // Admin
    // Dissociate user from Discord ID
    router.post('/dissociateDiscord', permissions.isAdmin, function(req, res){
        UserController.dissociateDiscord(req.userExecute, req.body.userID, logger.defaultResponse(req, res));
    })

    // Admin
    // Add item

    router.post('/createShopItem', permissions.isAdmin, function(req, res){
        ShopItemController.createItem(req.userExecute, req.body.name, req.body.description, req.body.price, req.body.maxOrders, req.body.ordersOpenTime, req.body.ordersCloseTime, logger.defaultResponse(req, res));
    })

    // Admin
    // Modify item
    router.post('/updateShopItem', permissions.isAdmin, function(req, res){
        ShopItemController.updateItem(req.userExecute, req.body.itemID, req.body.newDetails, logger.defaultResponse(req, res));
    })

    // Admin
    // Fulfill order
    router.post('/fulfillOrder', permissions.isAdmin, function(req, res){
        OrderController.fulfillOrder(req.userExecute, req.body.orderID, logger.defaultResponse(req, res));
    })

    // Admin
    // Cancel order
    router.post('/cancelOrder', permissions.isAdmin, function(req, res){
        OrderController.cancelOrder(req.userExecute, req.body.orderID, logger.defaultResponse(req, res));
    })

    // General
    // Create a submission
    router.post('/createSubmission', permissions.isVerified, upload.array('files', 10), function(req, res){
        let filenames = []
        if(req.files){
            filenames = req.files.map((file) => file.originalname);
        }
        SubmissionsController.createSubmission(req.userExecute._id, req.body.submissionBoxID, filenames, req.body.description, logger.defaultResponse(req, res));
    })

    // General
    // Get user submissions
    router.get('/getSubmissions', permissions.isVerified, function(req, res){
        SubmissionsController.getUserSubmissions(req.userExecute, req.query.userID, logger.defaultResponse(req, res));
    })

    // General
    // Get submission boxes
    router.get('/getSubmissionBoxes', permissions.isVerified, function(req, res){
        SubmissionsController.getSubmissionBoxes(logger.defaultResponse(req, res));
    })

    // General
    // Get all items
    router.get('/getShopItems', permissions.isVerified, function(req, res){
        ShopItemController.getItems(req.userExecute, logger.defaultResponse(req, res));
    })

    // General
    // Create order
    router.post('/createOrder', permissions.isVerified, function(req, res){
        OrderController.createOrder(req.userExecute, req.body.itemID, logger.defaultResponse(req, res));
    })

    // General
    // Get orders
    router.get('/getOrders', permissions.isVerified, function(req, res){
        UserController.getOrders(req.userExecute, req.query.userID || req.userExecute._id, logger.defaultResponse(req, res));
    })

    // Admin
    // Create event
    router.post('/createEvent', permissions.isAdmin, function(req, res){
        EventController.createEvent(req.userExecute, req.body.name, req.body.description, req.body.dateTime, logger.defaultResponse(req, res));
    })

    // Admin
    // Update event dates
    router.post('/updateEventDates', permissions.isAdmin, function(req, res){
        EventController.updateDates(req.userExecute, req.body.id, req.body.newDates, logger.defaultResponse(req, res));
    })

    // Admin
    // Update event options
    router.post('/updateEventOptions', permissions.isAdmin, function(req, res){
        EventController.updateOptions(req.userExecute, req.body.id, req.body.newOptions, logger.defaultResponse(req, res));
    })

    // Admin
    // Update event details
    router.post('/updateEventDetails', permissions.isAdmin, function(req, res){
        EventController.updateDetails(req.userExecute, req.body.id, req.body.newName, req.body.newDescription, logger.defaultResponse(req, res));
    })

    // Admin
    // Update event messages
    router.post('/updateEventMessages', permissions.isAdmin, function(req, res){
        EventController.updateMessages(req.userExecute, req.body.id, req.body.newMessages, logger.defaultResponse(req, res));
    })

    // Admin
    // Get event registered users
    router.get('/getEventRegisteredUsers', permissions.isAdmin, function(req, res){
        EventController.getRegistered(req.userExecute, req.query.id, req.query.pageSize, req.query.page, logger.defaultResponse(req, res));
    })

    // Admin
    // Get event registered users
    router.get('/getEventCheckedInUsers', permissions.isAdmin, function(req, res){
        EventController.getCheckedIn(req.userExecute, req.query.id, req.query.pageSize, req.query.page, logger.defaultResponse(req, res));
    })

    // Admin
    // Get all events
    router.get('/getAllEvents', permissions.isAdmin, function(req, res){
        EventController.getAllEvents(logger.defaultResponse(req, res));
    })

    // General
    // Get event by ID
    router.get('/getEvent', permissions.isVerified, function(req, res){
        EventController.getByID(req.userExecute, req.query.id, logger.defaultResponse(req, res));
    })

    // General
    // Get a filtered list of events
    router.get('/getFilteredEvents', permissions.isVerified, function(req, res){
        EventController.getFilteredEvents(req.userExecute, logger.defaultResponse(req, res));
    })

    // General
    // Register for an event
    router.post('/registerForEvent', permissions.isVerified, function(req, res){
        EventController.registerUser(req.userExecute, req.body.userID, req.body.eventID, logger.defaultResponse(req, res));
    })

    // General
    // Unregister for an event
    router.post('/unregisterFromEvent', permissions.isVerified, function(req, res){
        EventController.unregisterUser(req.userExecute, req.body.userID, req.body.eventID, logger.defaultResponse(req, res));
    })

    // General
    // Check in to an event
    router.post('/checkInToEvent', permissions.isVerified, function(req, res){
        EventController.checkInUser(req.userExecute, req.body.userID, req.body.eventID, req.body.checkInCode, logger.defaultResponse(req, res));
    })

    // General
    // Get event dashboard messages
    router.get('/getEventMessages', permissions.isVerified, function(req, res){
        EventController.getMessages(req.userExecute, req.query.eventID, logger.defaultResponse(req, res));
    })

    // Admin
    // Award points to a team
    router.post('/awardTeamPoints', permissions.isAdmin, function(req, res){
        TeamController.addPoints(req.userExecute, req.body.code, req.body.amount, req.body.notes, logger.defaultResponse(req, res));
    })

    // Admin
    // Award points to a user
    router.post('/awardUserPoints', permissions.isAdmin, function(req, res){
        UserController.addPoints(req.userExecute, req.body.id, req.body.amount, req.body.notes, logger.defaultResponse(req, res));
    })

    // Admin
    // Award event registered users points
    router.post('/awardEventRegisteredPoints', permissions.isAdmin, function(req, res){
        EventController.awardPointsToRegistered(req.userExecute, req.body.id, req.body.amount, req.body.notes, logger.defaultResponse(req, res));
    })

    // Admin
    // Award event checked in users points
    router.post('/awardEventCheckedInPoints', permissions.isAdmin, function(req, res){
        EventController.awardPointsToCheckedIn(req.userExecute, req.body.id, req.body.amount, req.body.notes, logger.defaultResponse(req, res));
    })

    // Admin
    // Deactivate all teams
    router.post('/deactivateAllTeams', permissions.isOwner, function(req, res){
        bulkModifyTeams.deactivateAll(req.userExecute, logger.defaultResponse(req, res));
    })

    // Admin
    // Deactivate one team
    router.post('/deactivateTeam', permissions.isOwner, function(req, res){
        TeamController.deactivateTeam(req.userExecute, req.body.code, logger.defaultResponse(req, res));
    })

	// Owner
	// Get queue size
	router.get('/getEmailQueueStats', permissions.isOwner, function(req, res){
		Settings.getEmailQueueStats(logger.defaultResponse(req, res));
	});

    // Owner
    // Get raw settings
    router.get('/getRawSettings', permissions.isOwner, function(req, res){
        Settings.getRawSettings(logger.defaultResponse(req, res));
    });


    // Admin
    // Get skill question
    router.get('/skill', permissions.isAdmin, function(req, res) {
        SettingsController.getVerificationProblem(req.userExecute, logger.defaultResponse(req, res));
    });

    // Admin
    // Some stats..
    router.post('/skillFail', permissions.isAdmin, function (req,res) {
        User.findOneAndUpdate({
            _id: req.userExecute._id
        }, {
            $inc : {
                'skillFail': 1
            }
        }, {}, function () {
            logger.defaultResponse(req,res)(null, {message: 'ok'});
        })
    });

    // Admin
    // More stats...
    router.post('/skillPass', permissions.isAdmin, function (req,res){

        User.findOneAndUpdate({
            _id: req.userExecute._id
        }, {
            $inc : {
                'skillPass': 1
            }
        }, {}, function () {
            logger.defaultResponse(req,res)(null, {message: 'ok'});
        })
    });


    // Owner
    // List emails
    router.post('/modifyUser', permissions.isOwner, function (req,res){
        UserController.modifyUser(req.userExecute, req.body.userID, req.body.data, logger.defaultResponse(req,res));
    });

    // Owner
    // Manually modify user
    router.get('/email/listTemplates', permissions.isOwner, function (req,res){
        mailer.listTemplates(logger.defaultResponse(req,res));
    });

    // Owner
    // Return emails
    router.get('/email/get/:templateName', permissions.isOwner, function (req,res){
        mailer.returnTemplate(req.params.templateName,logger.defaultResponse(req,res,false));
    });

    // Owner
    //Set emails
    router.post('/email/set/:templateName', permissions.isOwner, function (req,res){
        mailer.setTemplate(req.body.templateName,req.body.templateHTML,logger.defaultResponse(req,res));
    });

    // Admin
    // Get list of user fields
    router.get('/fields', permissions.isAdmin, function (req, res) {
        UserController.getUserFields(req.userExecute, req.query, logger.defaultResponse(req, res));
    });

    // Public
    // Get applications
    router.get('/applications', permissions.isVerified, function (req, res) {
        SettingsController.getApplications(req, logger.defaultResponse(req, res));
    });

    // Public
    // Get global settings
    router.get('/settings', function (req, res) {
        SettingsController.getSettings(logger.defaultResponse(req, res));
    });

    // Admin
    // View current stats
    router.get('/stats', permissions.isAdmin, function (req, res) {
        logger.defaultResponse(req, res)(null, stats.getStats())
    });

    // Owner
    // Get schools pending approval
    router.get('/pendingSchools', permissions.isOwner, function (req, res) {
        SettingsController.getPendingSchools(logger.defaultResponse(req, res))
    });

    // Owner
    // Approve pending school
    router.post('/approveSchool', permissions.isOwner, function (req, res) {
        var schoolName = req.body.school;
        SettingsController.approvePendingSchool(req.userExecute, schoolName, logger.defaultResponse(req, res));
    });

    // Owner
    // Reject pending school
    router.post('/rejectSchool', permissions.isOwner, function (req, res) {
        var schoolName = req.body.school;
        SettingsController.rejectPendingSchool(req.userExecute, schoolName, logger.defaultResponse(req, res));
    });

    // Owner
    // Modify application time
    router.post('/updateRegistrationTime', permissions.isOwner, function (req, res) {
        var newTimes = req.body;
        SettingsController.modifyTime(req.userExecute, newTimes, logger.defaultResponse(req, res));
    });

    // Owner
    // Modify application time
    router.post('/updateParticipantLimit', permissions.isOwner, function (req, res) {
        var limit = req.body;
        SettingsController.modifyLimit(req.userExecute, limit, logger.defaultResponse(req, res));
    });

    // Self or admin
    // Get self or user
    router.get('/user/:userID', permissions.isUser, function(req, res) {
        var userID = req.params.userID;
        User.getByID(userID, logger.defaultResponse(req, res), req.permissionLevel);
    });

    // Admin
    // Get Team Fields
    router.get('/teams/fields', permissions.isAdmin, function(req, res) {
        TeamController.getFields(req.userExecute, logger.defaultResponse(req, res));
    });


    // Admin
    // Data varies depending on permission
    // Get all teams
    router.post('/teams', permissions.isAdmin, function(req, res) {
        var query  = req.body;
        TeamController.getByQuery(req.userExecute, query, logger.defaultResponse(req, res));
    });

    // Checkin
    // Data varies depending on permission
    // Get all users
    router.post('/users', permissions.isCheckin, function(req, res) {
        var query  = req.body;
        UserController.getByQuery(req.userExecute, query, logger.defaultResponse(req, res));
    });

    // Developer
    // View system log
    router.post('/systemLog', permissions.isDeveloper, function (req, res) {
        var query  = req.body;
        SettingsController.getLog(query, logger.defaultResponse(req, res));
    });

    // Developer
    // Refresh statistics
    router.post('/refreshStatistics', permissions.isDeveloper, function (req, res) {
        stats.refreshStats(logger.defaultResponse(req, res));
    });

    // Developer
    // Get current commit id
    router.get('/version', permissions.isDeveloper, function (req, res) {
        SettingsController.getCurrentVersion(logger.defaultResponse(req, res));
    });

    // Owner
    // Force accept
    router.post('/forceAccept', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.admitUser(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Force reject
    router.post('/forceReject', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.rejectUser(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Reset admission state
    router.post('/resetAdmissionState', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.resetAdmissionState(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Flush email queue for user
    router.post('/flushEmailQueue', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.flushEmailQueue(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Delete user
    router.post('/deleteUser', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.remove(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // General
    // Send slack invite
    /*router.post('/slack', permissions.isVerified, function(req, res){
        var user = req.userExecute;

        UserController.inviteToSlack(user._id, function(err, data){
            if (err) {
                return logger.defaultResponse(req, res)(err);
            }

            return logger.defaultResponse(req, res)(null, data);
        });
    });*/

    // General
    // Create team
    router.post('/createTeam', permissions.isVerified, function(req, res){
        var user = req.userExecute;
        var teamName = req.body.teamName;

        TeamController.createTeam(user._id, teamName, function(err, data){
            if (err || !data) {
                return logger.defaultResponse(req, res)( err ? err : { error : 'Unable to create team' } );
            }

            return logger.defaultResponse(req, res)(null, data);
        });
    });

    // General
    // Join team
    router.post('/joinTeam', permissions.isVerified, function(req, res){
        var user = req.userExecute;
        var teamCode = req.body.teamCode;

        TeamController.joinTeam(user._id, teamCode, function(err, data){
            if (err || !data) {
                logger.defaultLogger.error(err);
                return logger.defaultResponse(req, res)( err ? err : { error : 'Unable to join team' } );
            }

            return logger.defaultResponse(req, res)(null, data);
        });
    });

    // General
    // Leave team
    router.post('/leaveTeam', permissions.isVerified, function(req, res){
        var user = req.userExecute;

        TeamController.leaveTeam(user._id, function(err, data){
            if (err || !data) {
                return logger.defaultResponse(req, res)( err ? err : { error : 'Unable to leave team' } );
            }

            return logger.defaultResponse(req, res)(null, data);
        });
    });

    // General
    // Get team
    router.get('/getTeam', permissions.isVerified, function(req, res){
        var user = req.userExecute;

        TeamController.getTeam(user._id, function(err, data){
            if (err) {
                return logger.defaultResponse(req, res)( err ? err : { error : 'Unable to get team' } );
            }

            return logger.defaultResponse(req, res)(null, data);
        });
    });

    // Admin
    // Remove user from team
    router.post('/removeFromTeam', permissions.isAdmin, function(req, res){
        var user = req.userExecute;
        var id = req.body.id;
        var code = req.body.code;

        TeamController.removeFromTeam(user, id, code, logger.defaultResponse(req, res));
    });

    // General
    // Upload waiver
    router.post('/uploadWaiver', /*permissions.isVerified,*/ function(req, res){
        var userID = 'asdsad'//req.body.id;

        var form = new formidable.IncomingForm();

        logger.defaultLogger.debug(req)

        form.parse(req, function (err, fields, files) {
            try {

                GridStore.write(userID, userID + '-waiver-' + files.data.name, files.data.path, function(err) {

                    if (err) {
                        return logger.defaultResponse(req, res)(err);
                    }

                    fs.unlink(files.data.path, function() {
                        logger.defaultLogger.debug('Deleted temp')

                        return logger.defaultResponse(req, res)(null, 'ok');
                    })
                });

            } catch (e) {
                logger.defaultLogger.error(e)
                return logger.defaultResponse(req, res)({ error : 'Something went wrong' });
            }
        });
    });

    // General
    // Get authorization
    router.get('/getResourceAuthorization', permissions.isVerified, function(req, res){
        var user = req.userExecute;
        var filename = req.query.filename;

        GridStore.authorize(user, filename, function (err, msg) {
            logger.defaultResponse(req, res)(err, msg);
        })
    });

    // General
    // Upload waiver
    router.get('/getResource', function(req, res){
        GridStore.read(req.query.token, res)
    });

    // Admin
    // Get team by code
    router.get('/getTeamByCode', permissions.isAdmin, function (req, res) {
        var code = req.query.code;
        TeamController.getByCode(code, logger.defaultResponse(req, res));
    });

    // Admin
    // Delete Team
    router.post('/deleteTeam', permissions.isAdmin, function (req, res) {
        var code = req.body.code;
        var user = req.userExecute;

        TeamController.deleteTeamByCode(user, code, logger.defaultResponse(req, res))
    });

    // Owner
    // Accept team
    router.post('/admitTeam', permissions.isOwner, function (req, res) {
        var teamCode = req.body.code;
        TeamController.teamAccept(req.userExecute, teamCode, logger.defaultResponse(req, res));
    });

    // Owner
    // Accept team
    router.post('/checkAllTeams', permissions.isOwner, function (req, res) {
        TeamController.checkAllTeams(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Reject team
    router.post('/rejectTeam', permissions.isOwner, function (req, res) {
        var teamCode = req.body.code;
        TeamController.teamReject(req.userExecute, teamCode, logger.defaultResponse(req, res));
    });

    // General
    // Update profile
    router.post('/updateProfile', permissions.isUser, function(req, res) {
        var userID = req.body.userID;
        var profile = req.body.profile;

        UserController.updateProfile(req.userExecute, userID, profile, logger.defaultResponse(req, res));
    });

    // General
    // Update confirmation

    /*
    router.post('/updateConfirmation', permissions.isUser, function(req, res) {
        var userID = req.body.userID;
        var confirmation = req.body.confirmation;

        UserController.updateConfirmation(req.userExecute, userID, confirmation, logger.defaultResponse(req, res));
    });*/

    router.post('/acceptInvitation', permissions.isVerified, function(req, res) {
        var confirmation = req.body.confirmation;

        UserController.acceptInvitation(req.userExecute, confirmation, logger.defaultResponse(req, res));
    });

    router.post('/declineInvitation', permissions.isVerified, function(req, res) {
        UserController.declineInvitation(req.userExecute, logger.defaultResponse(req, res));
    });

    router.post('/resetInvitation', permissions.isOwner, function(req, res) {
        var userID = req.body.userID;

        UserController.resetInvitation(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Send admit emails
    router.post('/sendAcceptanceEmails', permissions.isOwner, function (req, res) {

    });

    // Owner
    // Send reject emails
    router.post('/sendRejectionEmails', permissions.isOwner, function (req, res) {

    });

    // Owner
    // Send reminder emails
    router.post('/sendReminderEmails', permissions.isOwner, function (req, res) {

    });

    // Owner
    // Reject everyone without status
    router.post('/rejectNoState', permissions.isOwner, function (req, res) {
        UserController.rejectNoState(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Release all status
    router.post('/queueLagger', permissions.isOwner, function (req, res) {
        globalUsersManager.queueLagger(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Release all status
    router.post('/releaseAllStatus', permissions.isOwner, function (req, res) {
        globalUsersManager.releaseAllStatus(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Release all status accepted
    router.post('/releaseAllAccepted', permissions.isOwner, function (req, res) {
        globalUsersManager.releaseAllAccepted(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Unreject rejected users without status release
    router.post('/pushBackRejected', permissions.isOwner, function (req, res) {
        globalUsersManager.pushBackRejected(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Release all status waitlisted
    router.post('/releaseAllWaitlisted', permissions.isOwner, function (req, res) {
        globalUsersManager.releaseAllWaitlisted(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Release all status rejected
    router.post('/releaseAllRejected', permissions.isOwner, function (req, res) {
        globalUsersManager.releaseAllRejected(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Hide all status
    router.post('/hideAllStatus', permissions.isOwner, function (req, res) {
        globalUsersManager.hideAllStatusRelease(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Flash all email queue
    router.post('/flushAllEmails', permissions.isOwner, function (req, res) {
        globalUsersManager.flushAllEmails(req.userExecute, logger.defaultResponse(req, res));
    });

    // Owner
    // Activate account
    router.post('/activate', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.activate(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Owner
    // Deactivate account
    router.post('/deactivate', permissions.isOwner, function (req, res) {
        var userID = req.body.userID;
        UserController.deactivate(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Admin
    // Release Status
    router.post('/releaseStatus', permissions.isAdmin, function (req, res) {
        var userID = req.body.userID;
        UserController.releaseStatus(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Admin
    // Hide status
    router.post('/hideStatus', permissions.isAdmin, function (req, res) {
        var userID = req.body.userID;
        UserController.hideStatus(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Developer
    // Reset votes
    router.post('/voteReset', permissions.isDeveloper, function (req, res) {
        var userID = req.body.userID;
        UserController.resetVotes(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Reviewer
    // Votes admit
    router.post('/voteAdmit', permissions.isReviewer, function (req, res) {
        var userID = req.body.userID;
        UserController.voteAdmitUser(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Reviewer
    // Votes reject
    router.post('/voteReject', permissions.isReviewer, function (req, res) {
        var userID = req.body.userID;
        UserController.voteRejectUser(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    // Checkin
    // Checkin user
    router.post('/checkIn', permissions.isCheckin, function (req, res) {
        var userID = req.body.userID;
        var appPage = req.body.appPage ? req.body.appPage : null;
        UserController.checkIn(req.userExecute, userID, appPage, logger.defaultResponse(req, res));
    });

    // Checkin
    // Checkout user
    router.post('/checkOut', permissions.isCheckin, function (req, res) {
        var userID = req.body.userID;
        var appPage = req.body.appPage ? req.body.appPage : null;
        UserController.checkOut(req.userExecute, userID, appPage, logger.defaultResponse(req, res));
    });

    // Checkin
    // GridStore in
    router.post('/waiverIn', permissions.isAdmin, function (req, res) {
        var userID = req.body.userID;
        var appPage = req.body.appPage ? req.body.appPage : null;
        UserController.waiverIn(req.userExecute, userID, appPage, logger.defaultResponse(req, res));
    });

    // Checkin
    // GridStore out
    router.post('/waiverOut', permissions.isCheckin, function (req, res) {
        var userID = req.body.userID;
        UserController.waiverOut(req.userExecute, userID, logger.defaultResponse(req, res));
    });

    router.get('status', function(req, res) {
        res.json({'status' : 'up and running!'});
    });

    router.get('*', function (req, res) {
        res.json({'error' : 'lol what are you doing here?'});
    });
};
