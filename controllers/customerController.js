const Order = require('../models/Order');
const Customer = require('../models/Customer');

exports.getCustomers = async (req, res) => {
    try {
        const orders = await Order.find()
            .select('items totalAmount status customerName customerEmail customerPhone shippingAddress createdAt')
            .populate({ path: 'items.product', select: 'name' })
            .sort({ createdAt: -1 });
        const customersByKey = new Map();

        for (const order of orders) {
            const email = String(order.customerEmail || '').trim().toLowerCase();
            const phone = String(order.customerPhone || '').trim();
            const key = email || phone || String(order.customerName || '').trim().toLowerCase();
            if (!key) continue;

            if (!customersByKey.has(key)) {
                customersByKey.set(key, {
                    id: key,
                    name: order.customerName || 'Client sans nom',
                    email: order.customerEmail || '',
                    phone,
                    address: order.shippingAddress || '',
                    orders: [],
                    spent: 0,
                    pendingCount: 0,
                    lastOrderAt: order.createdAt || null,
                });
            }

            const customer = customersByKey.get(key);
            customer.orders.push({
                _id: order._id,
                totalAmount: order.totalAmount,
                status: order.status,
                createdAt: order.createdAt,
                items: (order.items || []).map((item) => ({
                    quantity: item.quantity,
                    product: item.product ? { name: item.product.name } : null,
                })),
            });

            if (order.status === 'confirmed' || order.status === 'paid') {
                customer.spent += Number(order.totalAmount) || 0;
            }
            if (order.status === 'pending') customer.pendingCount += 1;

            if (new Date(order.createdAt || 0) >= new Date(customer.lastOrderAt || 0)) {
                customer.name = order.customerName || customer.name;
                customer.email = order.customerEmail || customer.email;
                customer.phone = phone || customer.phone;
                customer.address = order.shippingAddress || customer.address;
                customer.lastOrderAt = order.createdAt || customer.lastOrderAt;
            }
        }

        const emails = Array.from(customersByKey.values())
            .map((customer) => customer.email.trim().toLowerCase())
            .filter(Boolean);
        const customerProfiles = await Customer.find({ email: { $in: emails } })
            .select('email isLoyal')
            .lean();
        const loyaltyByEmail = new Map(
            customerProfiles.map((customer) => [customer.email, customer.isLoyal]),
        );

        res.json(Array.from(customersByKey.values()).map((customer) => ({
            ...customer,
            isLoyal: loyaltyByEmail.get(customer.email.trim().toLowerCase()) || false,
        })));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch customers' });
    }
};

exports.updateCustomerLoyalty = async (req, res) => {
    try {
        const email = String(req.params.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: 'Customer email is required' });

        const customer = await Customer.findOneAndUpdate(
            { email },
            { $set: { email, isLoyal: req.body.isLoyal } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        ).select('email isLoyal');

        res.json({ email: customer.email, isLoyal: customer.isLoyal });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update customer loyalty status' });
    }
};