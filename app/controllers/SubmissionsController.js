const logger = require('../services/logger');

const SubmissionBox = require('../models/SubmissionBox');
const Submission = require('../models/Submission');

const SubmissionsController = {};

SubmissionsController.createSubmissionBox = function (name, description, openDate, closeDate, callback){
    if(!name || !description || isNaN(openDate) || isNaN(closeDate)){
        return callback({error: 'Invalid arguments.', code: 400, clean: true});
    }
    SubmissionBox.create({
        name: name,
        description: description,
        dates: {
            open: openDate,
            close: closeDate
        }
    }, function(err, submissionBox){
        if(err){
            logger.defaultLogger.error('Error creating submission box. ', err);
            return callback(err);
        }
        return callback(null, submissionBox);
    })
}

SubmissionsController.updateSubmissionBox = function(submissionBoxID, name, openDate, closeDate, callback){
    if(!submissionBoxID || !name || !description || isNaN(openDate) || isNaN(closeDate)){
        return callback({error: 'Invalid arguments.', code: 400, clean: true});
    }
    SubmissionBox.findOneAndUpdate({
        _id: submissionBoxID
    }, {
        name: name,
        description: description,
        dates: {
            open: openDate,
            close: closeDate
        }
    }, function(err, submissionBox){
        if(err){
            logger.defaultLogger.error(`Error updating submission box ${submissionBoxID}. `, err);
            return callback(err);
        }
        return callback(null);
    })
}

SubmissionsController.createSubmission = function (userID, submissionBoxID, files, description, callback){
    if(!userID || !submissionBoxID || !description){
        return callback({error: 'Invalid arguments.', code: 400, clean: true});
    }

    SubmissionBox.findOne({
        _id: submissionBoxID
    }, function(err, submissionBox){
        if(err){
            logger.defaultLogger.error('Error checking if the submission box ID is valid. ', err);
            return callback(err);
        }
        if(submissionBox){
            if(submissionBox.dates.open > Date.now()){
                return callback({
                    code: 403,
                    error: "Submissions are not yet open.",
                    clean: true
                })
            }
            else if(submissionBox.dates.close < Date.now()){
                return callback({
                    code: 403,
                    error: "Submissions have closed.",
                    clean: true
                })
            }
            else {
                Submission.create({
                    userID: userID,
                    description: description,
                    submissionBoxID: submissionBoxID,
                    submissionBoxName: submissionBox.name,
                    submitTime: Date.now(),
                    files: files
                }, function (err, submission) {
                    if (err) {
                        logger.defaultLogger.error('Error creating submission.. ', err);
                        return callback(err);
                    }
                    return callback(null, submission);
                })
            }
        }
        else {
            return callback({
                code: 404,
                error: "Submission box not found.",
                clean: true
            })
        }
    })
}

SubmissionsController.getUserSubmissions = function(userExecute, userID, callback) {
    if(!userExecute || !userID){
        return callback({error: 'Invalid arguments.', code: 400, clean: true});
    }
    if(userExecute._id.toString() !== userID && !userExecute.permissions.admin){
        return callback({error: "You cannot get that user's submissions.", clean: true, code: 403})
    }

    Submission.find({
        userID: userID
    }, function(err, submissions) {
        if(err){
            logger.defaultLogger.error(`Unable to fetch submissions for ${userID}. `, err);
            return callback(err);
        }
        return callback(null, submissions);
    })
}

SubmissionsController.getSubmissionBoxSubmissions = function(submissionBoxID, callback) {
    if(!submissionBoxID){
        return callback({error: 'Invalid arguments.', code: 400, clean: true});
    }
    Submission.find({
        submissionBoxID: submissionBoxID
    }, function(err, submissions) {
        if(err){
            logger.defaultLogger.error(`Unable to fetch submissions for box ${submissionBoxID}. `, err);
            return callback(err);
        }
        return callback(null, submissions);
    })
}

SubmissionsController.getSubmissionBoxes = function(callback){
    SubmissionBox.find({}, function(err, submissionBoxes){
        if(err){
            logger.defaultLogger.error("Unable to fetch submission boxes. ", err);
            return callback(err);
        }
        return callback(null, submissionBoxes);
    })
}

module.exports = SubmissionsController;