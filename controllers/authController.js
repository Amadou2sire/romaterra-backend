const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');

const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is required');
}

const createAccessToken = (admin) =>
    jwt.sign({ sub: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '15m' });

const createRefreshToken = async (admin) => {
    const token = jwt.sign({ sub: admin._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await RefreshToken.create({ admin: admin._id, token, expiresAt });
    return token;
};

exports.registerAdmin = async (req, res) => {
    try {
        console.log('ALLOW_ADMIN_REGISTER:', process.env.ALLOW_ADMIN_REGISTER);
        if (process.env.ALLOW_ADMIN_REGISTER !== 'true') {
            return res.status(403).json({ message: 'Admin registration is disabled' });
        }

        const { email, password } = req.body;

        const existing = await Admin.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'Admin already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const admin = await Admin.create({ email, passwordHash });
        res.status(201).json({ id: admin._id, email: admin.email });
    } catch (err) {
        res.status(400).json({ message: 'Failed to register admin' });
    }
};

exports.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const accessToken = createAccessToken(admin);
        const refreshToken = await createRefreshToken(admin);

        res.json({
            accessToken,
            refreshToken,
            admin: { id: admin._id, email: admin.email, role: admin.role },
        });
    } catch (err) {
        res.status(400).json({ message: 'Failed to login' });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token is required' });
        }

        const stored = await RefreshToken.findOne({ token: refreshToken }).populate('admin');
        if (!stored) return res.status(401).json({ message: 'Invalid refresh token' });
        if (stored.expiresAt < new Date()) {
            await stored.deleteOne();
            return res.status(401).json({ message: 'Refresh token expired' });
        }

        let payload;
        try {
            payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const admin = stored.admin;
        if (!admin || String(admin._id) !== payload.sub) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const newAccessToken = createAccessToken(admin);
        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(400).json({ message: 'Failed to refresh token' });
    }
};

exports.logoutAdmin = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        // Optional: Verify access token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const accessToken = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(accessToken, JWT_SECRET);
                // Verify refresh token belongs to same admin
                if (refreshToken) {
                    const stored = await RefreshToken.findOne({ token: refreshToken });
                    if (stored && String(stored.admin) !== decoded.sub) {
                        return res.status(403).json({ message: 'Refresh token does not match user' });
                    }
                }
            } catch (err) {
                // Access token might be expired, but we still allow logout
            }
        }

        if (refreshToken) {
            await RefreshToken.deleteOne({ token: refreshToken });
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        res.status(400).json({ message: 'Failed to logout' });
    }
};


