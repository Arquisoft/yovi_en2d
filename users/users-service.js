
const express = require('express');
const mongoose = require('mongoose');

require('dotenv').config();
require('./db');

// IMPORT MODELS
const User = require('./models/User');
const GameResult = require('./models/GameResult');
const Group = require('./models/Group');
const FriendRequest = require('./models/FriendRequest');

// CONFIGURATION
const app = express();
app.use(express.json()); // set up with json
const PORT = process.env.PORT || 3000; // use port from env or 3000 by default
const { httpMetricsMiddleware, register } = require("./monitoring/middleware/httpMetrics");
app.use(httpMetricsMiddleware);
// =============================   USERS ENDPOINTS    ============================================

/**
 * POST /createuser
 * Saves NEW USER in the db
 */
app.post('/createuser', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username is a mandatory field'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password is a mandatory field'
            });
        }

        let processedEmail = undefined;
        if (email && typeof email === 'string' && email.trim() !== '') {
            processedEmail = email.trim();
        }

        const userData = {
            username,
            email: processedEmail,
            password
        };

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        res.status(201).json({
            success: true,
            message: `User ${savedUser.username} created`,
            user: {
                id: savedUser._id,
                username: savedUser.username,
                email: savedUser.email || null,
                createdAt: savedUser.createdAt
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                error: `The ${field} field is already in the data base`
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                error: errors.join(', ')
            });
        }

        console.error('Error en POST /createuser:', error);
        res.status(500).json({
            success: false,
            error: 'Internal sevrer error'
        });
    }
});

/**
 * POST /login
 * Logs in an existing user to the app
 */
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are mandatory'
            });
        }

        const user = await User.findOne({ username: username.toString() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        res.json({
            success: true,
            message: `Welcome ${user.username}`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email || null
            }
        });
    } catch (error) {
        console.error('Error in POST /login:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /users
 * Gets ALL users from the db
 */
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// =========================   GAME RESULTS ENDPOINTS   =====================

/**
 * POST /gameresult
 * SAVE RESULT from a game into the db
 */
app.post('/gameresult', async (req, res) => {
    try {
        const { username, opponent, result, score } = req.body;

        // validation of mandatory field s
        if (!username || !opponent || !result) {
            return res.status(400).json({
                success: false,
                error: 'The are absent field/s : username, opponent, result are mandatory'
            });
        }

        // user existance verification
        const userExists = await User.findOne({ username: username.toString() });
        if (!userExists) {
            return res.status(404).json({
                success: false,
                error: `The user ${username} does not exist`
            });
        }

        // Save game results
        const game = new GameResult({
            username,
            opponent,
            result,
            score: score || 0
        });

        const savedGame = await game.save();

        res.status(201).json({
            success: true,
            message: 'Game result saved',
            game: savedGame
        });

    } catch (error) {
        console.error('Error in POST /gameresult:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /history/:username
 * Obtain the history of games from a user
 */
app.get('/history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 20 } = req.query; // By defect 20 games (Can be changed)

        const history = await GameResult.find({ username : username.toString() })
            .sort({ date: -1 }) // Order : from today to the past
            .limit(Number.parseInt(limit));

        // Stats
        const stats = {
            wins: history.filter(g => g.result === 'win').length,
            losses: history.filter(g => g.result === 'loss').length,
        };

        res.json({
            success: true,
            username,
            stats,
            total: history.length,
            games: history
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /ranking
 * Ranking of players by won games
 */
app.get('/ranking', async (req, res) => {
    try {
        const ranking = await GameResult.aggregate([
            { $match: { result: 'win' } }, // Only won games
            { $group: {
                    _id: '$username',
                    wins: { $sum: 1 },
                    lastGame: { $max: '$date' }
                }},
            { $sort: { wins: -1 } }, // Most wins first
            { $limit: 10 },
            { $project: {
                    username: '$_id',
                    wins: 1,
                    lastGame: 1,
                    _id: 0
                }}
        ]);

        res.json({
            success: true,
            ranking
        });

    } catch (error) {
        console.error('Error in GET /ranking:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ──────────────────────────────────────────────────────────────────────
// LEADERBOARD ENDPOINT
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /leaderboard
 * Returns all players with their win/loss stats, sorted by wins by default.
 */
app.get('/leaderboard', async (req, res) => {
    try {
        const agg = await GameResult.aggregate([
            {
                $group: {
                    _id: '$username',
                    wins:     { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
                    losses:   { $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] } },
                    total:    { $sum: 1 },
                    lastGame: { $max: '$date' },
                },
            },
            {
                $project: {
                    username: '$_id',
                    wins: 1,
                    losses: 1,
                    total: 1,
                    lastGame: 1,
                    winRate: {
                        $cond: [
                            { $gt: ['$total', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$wins', '$total'] }, 100] }, 0] },
                            0,
                        ],
                    },
                    _id: 0,
                },
            },
            { $sort: { wins: -1, winRate: -1 } },
        ]);

        res.json({ success: true, leaderboard: agg });
    } catch (error) {
        console.error('Error in GET /leaderboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ──────────────────────────────────────────────────────────────────────
// USER PROFILE WITH STATS (for Social page)
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /users/profile/:username?me=<currentUser>
 * Returns profile + stats + friend status relative to 'me'.
 */
app.get('/users/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const me = req.query.me;

        const user = await User.findOne({ username: username.toString() });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        // Stats
        const games = await GameResult.find({ username: username.toString() });
        const wins   = games.filter(g => g.result === 'win').length;
        const losses = games.filter(g => g.result === 'loss').length;
        const total  = games.length;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        // Friend status
        let friendStatus = 'none';
        if (me && me !== username) {
            const req1 = await FriendRequest.findOne({ from: me, to: username, status: 'accepted' });
            const req2 = await FriendRequest.findOne({ from: username, to: me, status: 'accepted' });
            if (req1 || req2) {
                friendStatus = 'friends';
            } else {
                const sent     = await FriendRequest.findOne({ from: me, to: username, status: 'pending' });
                const received = await FriendRequest.findOne({ from: username, to: me, status: 'pending' });
                if (sent)     friendStatus = 'pending_sent';
                if (received) friendStatus = 'pending_received';
            }
        }

        res.json({
            success: true,
            profile: {
                username: user.username,
                email: user.email || null,
                createdAt: user.createdAt,
                stats: { wins, losses, total, winRate },
                friendStatus,
            },
        });
    } catch (error) {
        console.error('Error in GET /users/profile/:username:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * GET /users/search?q=<query>&me=<currentUser>
 * Search users by username prefix.
 */
app.get('/users/search', async (req, res) => {
    try {
        const { q, me } = req.query;
        if (!q) return res.json({ success: true, users: [] });

        const users = await User.find({
            username: { $regex: q.toString(), $options: 'i' },
        }).limit(20);

        const results = await Promise.all(users.map(async (u) => {
            const games = await GameResult.find({ username: u.username });
            const wins   = games.filter(g => g.result === 'win').length;
            const losses = games.filter(g => g.result === 'loss').length;
            const total  = games.length;

            let friendStatus = 'none';
            if (me && me !== u.username) {
                const accepted1 = await FriendRequest.findOne({ from: me, to: u.username, status: 'accepted' });
                const accepted2 = await FriendRequest.findOne({ from: u.username, to: me, status: 'accepted' });
                if (accepted1 || accepted2) {
                    friendStatus = 'friends';
                } else {
                    const sent     = await FriendRequest.findOne({ from: me, to: u.username, status: 'pending' });
                    const received = await FriendRequest.findOne({ from: u.username, to: me, status: 'pending' });
                    if (sent)     friendStatus = 'pending_sent';
                    if (received) friendStatus = 'pending_received';
                }
            }

            return { username: u.username, stats: { wins, losses, total }, friendStatus };
        }));

        res.json({ success: true, users: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// ──────────────────────────────────────────────────────────────────────
// FRIEND REQUESTS
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /friends/:username
 * Returns all accepted friends of a user (with basic stats).
 */
app.get('/friends/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const accepted = await FriendRequest.find({
            $or: [{ from: username, status: 'accepted' }, { to: username, status: 'accepted' }],
        });

        const friendNames = accepted.map(r => r.from === username ? r.to : r.from);

        const friends = await Promise.all(friendNames.map(async (name) => {
            const games  = await GameResult.find({ username: name });
            const wins   = games.filter(g => g.result === 'win').length;
            const losses = games.filter(g => g.result === 'loss').length;
            return { username: name, stats: { wins, losses, total: games.length }, friendStatus: 'friends' };
        }));

        res.json({ success: true, friends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * GET /friends/requests/:username
 * Returns all pending friend requests involving this user.
 */
app.get('/friends/requests/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const requests = await FriendRequest.find({
            $or: [{ from: username, status: 'pending' }, { to: username, status: 'pending' }],
        }).sort({ createdAt: -1 });

        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /friends/request
 * Send a friend request from 'from' to 'to'.
 */
app.post('/friends/request', async (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to) return res.status(400).json({ success: false, error: 'from and to are required' });
        if (from === to) return res.status(400).json({ success: false, error: 'Cannot add yourself' });

        // Check already friends or pending
        const existing = await FriendRequest.findOne({
            $or: [
                { from, to },
                { from: to, to: from },
            ],
            status: { $in: ['pending', 'accepted'] },
        });

        if (existing) return res.status(400).json({ success: false, error: 'Request already exists or already friends' });

        const request = new FriendRequest({ from, to });
        await request.save();
        res.status(201).json({ success: true, request });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /friends/respond
 * Accept or reject a friend request.
 */
app.post('/friends/respond', async (req, res) => {
    try {
        const { requestId, action } = req.body;
        if (!requestId || !action) return res.status(400).json({ success: false, error: 'requestId and action required' });

        const request = await FriendRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

        request.status = action === 'accept' ? 'accepted' : 'rejected';
        await request.save();
        res.json({ success: true, request });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /friends/remove
 * Remove a friendship between two users.
 */
app.post('/friends/remove', async (req, res) => {
    try {
        const { username, friend } = req.body;
        await FriendRequest.deleteMany({
            $or: [
                { from: username, to: friend },
                { from: friend, to: username },
            ],
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// ──────────────────────────────────────────────────────────────────────
// GROUPS
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /groups/:username
 * Returns all groups the user belongs to.
 */
app.get('/groups/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const groups = await Group.find({ members: username }).sort({ createdAt: -1 });
        res.json({ success: true, groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * GET /groups/search?q=<query>
 * Search groups by name.
 */
app.get('/groups/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, groups: [] });
        const groups = await Group.find({ name: { $regex: q.toString(), $options: 'i' } }).limit(20);
        res.json({ success: true, groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /groups
 * Create a new group.
 */
app.post('/groups', async (req, res) => {
    try {
        const { name, description, owner } = req.body;
        if (!name || !owner) return res.status(400).json({ success: false, error: 'name and owner are required' });

        const group = new Group({ name, description, owner, members: [owner] });
        const saved = await group.save();
        res.status(201).json({ success: true, group: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /groups/:groupId/join
 * Add a user to a group.
 */
app.post('/groups/:groupId/join', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { username } = req.body;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
        if (group.members.includes(username)) return res.status(400).json({ success: false, error: 'Already a member' });

        group.members.push(username);
        await group.save();
        res.json({ success: true, group });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * POST /groups/:groupId/leave
 * Remove a user from a group.
 */
app.post('/groups/:groupId/leave', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { username } = req.body;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
        if (group.owner === username) return res.status(400).json({ success: false, error: 'Owner cannot leave. Delete the group instead.' });

        group.members = group.members.filter(m => m !== username);
        await group.save();
        res.json({ success: true, group });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /health
 * Endpoint to check if all is okay
 */
app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    res.json({
        status: 'OK',
        server: 'running',
        database: states[dbState],
        timestamp: new Date()
    });
});

module.exports = app;

// ================= METRICS =================
app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
});

// =============================== START THE SERVER   ======================================

if (require.main == module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        console.log(`📡 Endpoints disponibles:`);
        console.log(`   POST   /createuser`);
        console.log(`   GET    /users`);
        console.log(`   POST   /gameresult`);
        console.log(`   GET    /history/:username`);
        console.log(`   GET    /ranking`);
        console.log(`   GET    /health`);
    });
}

// Handeling for not cactched errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});