const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        isLoyal: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);