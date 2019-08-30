require('dotenv').config();
const express = require('express');

const app = express();

const mongoose        = require('mongoose');
const port            = process.env.PORT || 3005;
const database        = process.env.DATABASE || 'mongodb://localhost:27017/goose';

// Start configuration
const organizers      = require('./config/organizers');
const settings        = require('./config/settings');

const Waiver          = require('./app/models/GridStore');

mongoose.connect(database,
    {
        auto_reconnect: true,
        useNewUrlParser: true,
        useFindAndModify: false,
        useCreateIndex: true
    }).then(() => {
        Waiver.init(mongoose.connection.db)
    })
    .catch(error => {
        console.log("DB CONNECTION ERROR");
        console.log(error)
    });

let githubRouter = express.Router();
require('./app/routes/github')(githubRouter);
app.use('/github', githubRouter);

var apiRouter = express.Router();
require('./app/routes/api')(apiRouter);
app.use('/api', apiRouter);

var authRouter = express.Router();
require('./app/routes/auth')(authRouter);
app.use('/auth', authRouter);

app.listen(port, () => {
    console.log(`listening on port ${port}`);
});