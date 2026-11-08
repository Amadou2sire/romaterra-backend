const express = require('express');
const {
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
} = require('../controllers/collectionController');
const { authenticateAdmin } = require('../middleware/auth');
const uploadUtils = require('../utils/uploadUtils');
const uploadImage = uploadUtils.uploadImage;

const router = express.Router();

router.get('/', getCollections);
router.get('/:id', getCollection);
router.post('/', authenticateAdmin, uploadImage, createCollection);
router.put('/:id', authenticateAdmin, uploadImage, updateCollection);
router.delete('/:id', authenticateAdmin, deleteCollection);

module.exports = router;