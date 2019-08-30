const Settings = require('../app/models/Settings');
const fs       = require('fs');

// Check if settings exists
// If not, create new object
Settings.findOne({}, function(err, settings){
    if (err) throw err;

    if (!settings){
        fs.readFile('config/data/schools.txt', 'utf8', function(err, data) {
            if (err) throw err;

            Settings.create({
                schools: data.split('\n')
            }, function(err) {
                if (err) throw err;

                console.log('Settings created.');
            });
        });
    }
});
