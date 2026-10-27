const express = require('express');
const { getShipping, updateShipping } = require('../controllers/settingController');
const { authenticateAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { shippingSchema } = require('../validation/schemas');

const router = express.Router();

// Public: the storefront reads the shipping fee.
router.get('/shipping', getShipping);
// Admin only: update the shipping fee.
router.put('/shipping', authenticateAdmin, validate(shippingSchema), updateShipping);

module.exports = router;