const mongoose = require('mongoose');

// Simple key/value store for global app settings (e.g. shipping fee).
const settingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);