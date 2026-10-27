const express = require('express');
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} = require('../controllers/orderController');
const { authenticateAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateQuery = require('../middleware/validateQuery');
const { checkoutLimiter } = require('../middleware/rateLimit');
const { orderCreateSchema, orderStatusSchema, orderListQuerySchema } = require('../validation/schemas');

const router = express.Router();

router.get('/', authenticateAdmin, validateQuery(orderListQuerySchema), getOrders);
router.get('/:id', authenticateAdmin, getOrderById);
router.post('/', checkoutLimiter, validate(orderCreateSchema), createOrder);
router.patch('/:id/status', authenticateAdmin, validate(orderStatusSchema), updateOrderStatus);
router.delete('/:id', authenticateAdmin, deleteOrder);

module.exports = router;





