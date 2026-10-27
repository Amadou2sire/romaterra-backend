const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

// Caps on anonymous checkout so a single request cannot reserve the whole stock.
// The per-item cap applies after duplicates are merged (see normalizeOrderItems).
const MAX_ITEMS_PER_ORDER = 20;
const MAX_QUANTITY_PER_ITEM = 10;

const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const registerSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8),
});

const orderCreateSchema = z.object({
  items: z
    .array(
      z.object({
        product: objectId,
        quantity: z.coerce.number().int().positive().max(MAX_QUANTITY_PER_ITEM),
      })
    )
    .min(1)
    .max(MAX_ITEMS_PER_ORDER),
  customerName: z.string().trim().min(1).max(100),
  customerEmail: z.email().trim().max(254),
  customerPhone: z
    .string()
    .trim()
    .min(6, 'Phone number is too short')
    .max(30, 'Phone number is too long'),
  shippingAddress: z.string().trim().min(5).max(500),
});

const orderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'paid', 'cancelled']),
});

// Query params pour GET /orders/ (filtres dashboard).
// `status` optionnel : si présent, doit être un statut valide.
// `date` optionnel : YYYY-MM-DD ; on accepte la string et on convertit en Date côté controller.
const orderListQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'paid', 'cancelled']).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

const shippingSchema = z.object({
  fee: z.coerce.number().min(0, 'Shipping fee must be zero or positive'),
});

const customerLoyaltySchema = z.object({
  isLoyal: z.boolean(),
});

module.exports = {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  MAX_QUANTITY_PER_ITEM,
  orderCreateSchema,
  orderStatusSchema,
  orderListQuerySchema,
  shippingSchema,
  customerLoyaltySchema,
};
