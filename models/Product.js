const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, required: true, min: 0 },
        images: { type: [String], default: [] },
        quantityInStock: { type: Number, default: 0, min: 0 },
        status: { type: String },
        size: { type: String },
        promoPrice: { type: Number, default: 0, min: 0 },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);





