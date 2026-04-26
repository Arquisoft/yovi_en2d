const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
    },
    owner: {
        type: String,
        required: true,
    },
    members: {
        type: [String],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

groupSchema.index({ name: 'text' });

module.exports = mongoose.model('Group', groupSchema);