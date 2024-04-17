const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

const MONGODB_URI = process.env.MONGODB_URI ||'mongodb://localhost:27017/mydb';

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


