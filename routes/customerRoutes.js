const express = require('express');
const { getCustomers, updateCustomerLoyalty } = require('../controllers/customerController');
const { authenticateAdmin, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { customerLoyaltySchema } = require('../validation/schemas');

const router = express.Router();

router.get('/', authenticateAdmin, authorizeRoles('superadmin'), getCustomers);
router.patch(
	'/:email/loyalty',
	authenticateAdmin,
	authorizeRoles('superadmin'),
	validate(customerLoyaltySchema),
	updateCustomerLoyalty,
);

module.exports = router;