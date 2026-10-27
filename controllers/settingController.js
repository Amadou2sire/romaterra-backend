const Setting = require('../models/Setting');

const SHIPPING_KEY = 'shipping';

// Public read: returns the shipping fee applied to every order.
exports.getShipping = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: SHIPPING_KEY });
        const fee = setting?.value?.fee ?? 0;
        res.json({ fee });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch shipping settings' });
    }
};

// Admin only: persists the flat shipping fee (upsert on the shipping key).
exports.updateShipping = async (req, res) => {
    try {
        const { fee } = req.body;
        const setting = await Setting.findOneAndUpdate(
            { key: SHIPPING_KEY },
            { key: SHIPPING_KEY, value: { fee } },
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ fee: setting.value.fee });
    } catch (err) {
        res.status(400).json({ message: 'Failed to update shipping settings' });
    }
};