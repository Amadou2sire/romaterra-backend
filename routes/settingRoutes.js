const express = require('express');
const {
    getShipping,
    updateShipping,
    getBanner,
    addBannerSlide,
    deleteBannerSlide,
} = require('../controllers/settingController');
const { authenticateAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { shippingSchema, bannerSlideSchema } = require('../validation/schemas');
const { uploadMedia } = require('../utils/uploadUtils');

const router = express.Router();

// Public: the storefront reads the shipping fee.
router.get('/shipping', getShipping);
// Admin only: update the shipping fee.
router.put('/shipping', authenticateAdmin, validate(shippingSchema), updateShipping);

// Public: the storefront reads the home banner.
router.get('/banner', getBanner);
// Admin only: add or remove a banner slide (image or video).
router.post('/banner', authenticateAdmin, uploadMedia, validate(bannerSlideSchema), addBannerSlide);
router.delete('/banner/:id', authenticateAdmin, deleteBannerSlide);

module.exports = router;
