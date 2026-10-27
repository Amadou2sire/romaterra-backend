    const mongoose = require('mongoose');

    const orderItemSchema = new mongoose.Schema(
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true, min: 0 }, // snapshot of price at order time
        },
        { _id: false }
    );

    const orderSchema = new mongoose.Schema(
        {
            items: { type: [orderItemSchema], required: true },
            totalAmount: { type: Number, required: true, min: 0 },
            status: {
                type: String,
                enum: ['pending', 'confirmed', 'paid', 'cancelled'],
                default: 'pending',
            },
            customerName: { type: String, trim: true, required: true },
            customerEmail: { type: String, trim: true, required: true },
            customerPhone: { type: String, trim: true, required: true },
            shippingAddress: { type: String, trim: true, required: true },
        },
        { timestamps: true }
    );

    module.exports = mongoose.model('Order', orderSchema);
