const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MongoDB URL not found in variables');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => {
        console.error('MongoDB connection error');
        console.error(error);
        process.exit(1);
    });

module.exports = mongoose;