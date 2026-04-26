const mongoose2 = require('mongoose');

const friendRequestSchema = new mongoose2.Schema({
    from: { type: String, required: true },
    to:   { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose2.model('FriendRequest', friendRequestSchema);