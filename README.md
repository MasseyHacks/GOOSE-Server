# MasseyHacks Registration System (CODENAME: GOOSE)

[![Travis-CI badge](https://travis-ci.org/MasseyHacks/MasseyHacks-V-Registration.svg?branch=master)](https://travis-ci.com)

Registration system for MasseyHacks V. Goose is currently being developed and is extremely unstable at the current state. Please use with caution.

**Setup**

Start off with making the db directory and running mongodb

```
mkdir db
mongod --dbpath db
```

Run

```
npm install
```

to install all dependencies. If you are running on a system with low memory (< 1GB). Please allocate space for swap to ensure npm can complete its install.

After npm install is completed, run

```
cp .env.template .env
```

to create a new settings file. Fill in all the fields. 

After that, run 

```
cp config/data/organizers.json.template config/data/organizers.json
```

to create a new organizers file. This will store the initial organizers who will have superuser access. Edit the default values to your information.

To start goose, run

```
npm start
```

Congrats, the Goose server should now be running!(Hopefully)

**Docker Setup**

Docker support is **EXTREMELY** experimental and certain features may be unstable or unavailable. For example, email templates will be reset whenever you rebuild the image and you cannot modify any configuration files. We do not recommend using it at this time.

To use the image, simply run the following command:

```
docker run --env-file .env -p 3005:3005 jamesxu123/masseyhacks:latest
```

You must create an .env file and pass it to the container or GOOSE will not work. Instructions can be found above.

___
Developed By: Henry Tu, James Xu, Ryan Zhang, David Hui
