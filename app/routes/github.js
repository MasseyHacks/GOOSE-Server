const express = require('express');
const spawn = require('child_process').spawn;
const crypto = require('crypto');
const logger = require('../services/logger');
require('dotenv').config();

GITHUB_SECRET = process.env.GITHUB_SECRET;

module.exports = function (router) {
    router.use(express.json());

    router.post('/pull', function (req, res) {
        let sig = "sha1=" + crypto.createHmac('sha1', GITHUB_SECRET).update(JSON.stringify(req.body)).digest('hex');

        logger.defaultLogger.debug(req.headers['x-hub-signature'], sig)
        if (req.headers['x-hub-signature'] === sig) {

            var child = spawn('./pull.sh');

            child.stdout.on('data', function(data) {
                logger.defaultLogger.debug('child stdout:\n' + data);

                logger.logAction(-1, -1, 'Webhook source update successful. Commit: ' + req.body['head_commit']['message'], data);
            });

            res.send("me has pulled");
            logger.defaultLogger.info("Pulled update from GitHub.");
        } else {
            logger.logAction(-1, -1, 'Webhook source update rejected', 'IP: ' + (req.headers['x-forwarded-for'] || req.connection.remoteAddress) + ' Headers: ' + (req.rawHeaders).toString());

            res.send("lmao u can't do that");
            logger.defaultLogger.warn("Attempted pull trigger failed signature check.");
        }

        res.end();
    })
};