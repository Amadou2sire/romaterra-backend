const express = require('express');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const collectionRoutes = require('./collectionRoutes');
const orderRoutes = require('./orderRoutes');
const authRoutes = require('./authRoutes');
const settingRoutes = require('./settingRoutes');
const customerRoutes = require('./customerRoutes');

const router = express.Router();

// Root route
router.get('/', (req, res) => {
    res.send('Romaterra backend is running');
});

// Domain routes
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/collections', collectionRoutes);
router.use('/orders', orderRoutes);
router.use('/auth', authRoutes);
router.use('/settings', settingRoutes);
router.use('/customers', customerRoutes);

module.exports = router;