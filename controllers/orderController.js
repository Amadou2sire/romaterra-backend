const Order = require('../models/Order');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');
const { normalizeOrderItems } = require('../utils/orderUtils');
const { sendNewOrderEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const { MAX_QUANTITY_PER_ITEM } = require('../validation/schemas');

// Put the order's quantities back in stock (used when an order is cancelled or deleted).
const restoreStock = async (order, session) => {
    for (const item of order.items) {
        await Product.updateOne(
            { _id: item.product },
            { $inc: { quantityInStock: item.quantity } },
            { session }
        );
    }
};

exports.getOrders = async (req, res) => {
    try {
        // Filtres optionnels validés par orderListQuerySchema (middleware validateQuery).
        const filter = {};
        if (req.query.status) {
            filter.status = req.query.status;
        }
        if (req.query.date) {
            // "YYYY-MM-DD" → [startOfDay, startOfNextDay) en UTC.
            // Le Order schema a timestamps:true → createdAt existe.
            const [y, m, d] = req.query.date.split('-').map(Number);
            const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
            filter.createdAt = { $gte: start, $lt: end };
        }
        const orders = await Order.find(filter).populate('items.product');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.product');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch order' });
    }
};

exports.createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { items, customerName, customerEmail, customerPhone, shippingAddress } = req.body;
        const normalizedItems = normalizeOrderItems(items);
        if (normalizedItems.some((item) => item.quantity > MAX_QUANTITY_PER_ITEM)) {
            return res.status(400).json({
                message: `Maximum ${MAX_QUANTITY_PER_ITEM} units per product`,
            });
        }

        // Flat shipping fee configured in the dashboard; included in the stored total.
        const shippingSetting = await Setting.findOne({ key: 'shipping' });
        const shippingFee = shippingSetting?.value?.fee ?? 0;
         // 1) Check stock for each item
        let createdOrder;
        await session.withTransaction(async () => {
            const productIds = normalizedItems.map((item) => item.product);
            const products = await Product.find({ _id: { $in: productIds } })
                .session(session)
                .select('_id name price quantityInStock');
            const productMap = new Map(products.map((product) => [String(product._id), product]));

            const snapshotItems = [];
            let totalAmount = 0;

            for (const item of normalizedItems) {
                const product = productMap.get(String(item.product));
                if (!product) {
                    throw new Error(`Product not found: ${item.product}`);
                }
        // 2) Compute total and decrement stock
                const updated = await Product.findOneAndUpdate(
                    { _id: item.product, quantityInStock: { $gte: item.quantity } },
                    { $inc: { quantityInStock: -item.quantity } },
                    { new: true, session }
                );

                if (!updated) {
                    throw new Error(`Not enough stock for product ${product.name}`);
                }

                snapshotItems.push({
                    product: product._id,
                    quantity: item.quantity,
                    price: product.price,
                });
                totalAmount += product.price * item.quantity;
            }

            createdOrder = await Order.create(
                [
                    {
                        items: snapshotItems,
                        totalAmount: totalAmount + shippingFee,
                        status: 'pending',
                        customerName,
                        customerEmail,
                        customerPhone,
                        shippingAddress,
                    },
                ],
                { session }
            );
        });

        const order = createdOrder[0];
        res.status(201).json(order);

        sendNewOrderEmail(order).catch((emailErr) => {
            logger.error({ err: emailErr, orderId: String(order._id) }, 'Failed to send order email');
        });
    } catch (err) {
        res.status(400).json({ message: err.message || 'Failed to create order' });
    } finally {
        await session.endSession();
    }
};

exports.updateOrderStatus = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { status } = req.body;
        let updated;
        await session.withTransaction(async () => {
            const order = await Order.findById(req.params.id).session(session);
            if (!order) return;
            const wasCancelled = order.status === 'cancelled';
            if (wasCancelled && status !== 'cancelled') {
                const error = new Error('Cancelled order cannot be reopened');
                error.statusCode = 409;
                throw error;
            }
            // Release the reserved stock when an order gets cancelled.
            if (!wasCancelled && status === 'cancelled') {
                await restoreStock(order, session);
            }
            order.status = status;
            updated = await order.save({ session });
        });
        if (!updated) return res.status(404).json({ message: 'Order not found' });
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.statusCode ? err.message : 'Failed to update order',
        });
    } finally {
        await session.endSession();
    }
};

// Delete an order (admin only). The dashboard OrdersPage calls this.
exports.deleteOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        let deleted;
        await session.withTransaction(async () => {
            deleted = await Order.findByIdAndDelete(req.params.id, { session });
            // Only a pending order still holds reserved stock: a cancelled one was
            // already restored, and confirmed/paid ones are treated as sold.
            if (deleted && deleted.status === 'pending') {
                await restoreStock(deleted, session);
            }
        });
        if (!deleted) return res.status(404).json({ message: 'Order not found' });
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete order' });
    } finally {
        await session.endSession();
    }
};


