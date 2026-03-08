const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            success: false,
            error: "Missing token"
        });
    }

    const token = header.split(' ')[1];

    try {

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
};

module.exports = authMiddleware;