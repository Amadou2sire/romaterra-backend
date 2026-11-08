const Setting = require('../models/Setting');
const { randomUUID } = require('crypto');
const { MAX_IMAGE_SIZE, uploadImageBuffer, uploadVideoBuffer } = require('../utils/uploadUtils');

const SHIPPING_KEY = 'shipping';

// Public read: returns the shipping fee applied to every order.
exports.getShipping = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: SHIPPING_KEY });
        const fee = setting?.value?.fee ?? 0;
        res.json({ fee });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch shipping settings' });
    }
};

// Admin only: persists the flat shipping fee (upsert on the shipping key).
exports.updateShipping = async (req, res) => {
    try {
        const { fee } = req.body;
        const setting = await Setting.findOneAndUpdate(
            { key: SHIPPING_KEY },
            { key: SHIPPING_KEY, value: { fee } },
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ fee: setting.value.fee });
    } catch (err) {
        res.status(400).json({ message: 'Failed to update shipping settings' });
    }
};

const BANNER_KEY = 'banner';
const MAX_BANNER_SLIDES = 10;

const readBannerSlides = async () => {
    const setting = await Setting.findOne({ key: BANNER_KEY });
    return setting?.value?.slides ?? [];
};

// Public read: slides displayed in the storefront home banner.
exports.getBanner = async (req, res) => {
    try {
        res.json({ slides: await readBannerSlides() });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch banner' });
    }
};

// Admin only: uploads an image or a video and appends it to the banner.
exports.addBannerSlide = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'An image or a video is required' });
        }
        const isVideo = req.file.mimetype.startsWith('video/');
        if (!isVideo && req.file.size > MAX_IMAGE_SIZE) {
            return res.status(400).json({ message: 'Images must not exceed 5 MB' });
        }
        if ((await readBannerSlides()).length >= MAX_BANNER_SLIDES) {
            return res.status(400).json({ message: `Maximum ${MAX_BANNER_SLIDES} banner slides` });
        }

        const url = isVideo
            ? await uploadVideoBuffer(req.file.buffer, 'romaterra/banner', req.file.mimetype.split('/')[1])
            : await uploadImageBuffer(req.file.buffer, 'romaterra/banner');
        const slide = {
            id: randomUUID(),
            type: isVideo ? 'video' : 'image',
            url,
            link: req.body.link || '/offer',
        };

        const setting = await Setting.findOneAndUpdate(
            { key: BANNER_KEY },
            { $push: { 'value.slides': slide } },
            { new: true, upsert: true }
        );
        res.status(201).json({ slides: setting.value.slides });
    } catch (err) {
        res.status(400).json({ message: 'Failed to add banner slide' });
    }
};

// Admin only: removes a slide from the banner.
exports.deleteBannerSlide = async (req, res) => {
    try {
        const setting = await Setting.findOneAndUpdate(
            { key: BANNER_KEY },
            { $pull: { 'value.slides': { id: req.params.id } } },
            { new: true }
        );
        res.json({ slides: setting?.value?.slides ?? [] });
    } catch (err) {
        res.status(400).json({ message: 'Failed to delete banner slide' });
    }
};
