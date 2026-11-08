const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Collection = require('../models/Collection');
const { deleteImage, uploadImageBuffer } = require('../utils/uploadUtils');

// Convert a value that could be an ObjectId, an id string, or a name
// into an ObjectId. Accepts either a valid 24-hex id or a name; if it looks
// neither like a valid id nor a name, returns the original value (and the
// Mongo cast will produce a clear error).
const resolveRefId = async (Model, value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && value._id) return value._id;
  const str = String(value);
  if (mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str) {
    return str;
  }
  // Treat as a name and look it up
  const doc = await Model.findOne({ name: str }).select('_id');
  if (!doc) {
    const error = new Error(`Unknown ${Model.modelName} name: "${str}"`);
    error.statusCode = 400;
    throw error;
  }
  return doc._id;
};

// Only these fields may be set from the request body; anything else
// (_id, createdAt, Mongo operators...) is dropped.
const PRODUCT_FIELDS = [
  'name', 'description', 'price', 'promoPrice', 'quantityInStock',
  'status', 'size', 'category', 'collection', 'images', 'replaceImages',
];

const pickProductFields = (body = {}) => {
  const picked = {};
  for (const field of PRODUCT_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    // Plain values only: rejects objects like { "$gt": "" } sent as JSON.
    const isScalar = ['string', 'number', 'boolean'].includes(typeof value);
    const isStringArray = field === 'images' && Array.isArray(value) && value.every((v) => typeof v === 'string');
    if (isScalar || isStringArray) picked[field] = value;
  }
  return picked;
};

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('category collection');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch products', error: err.message });
  }
};

// Get single product
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category collection');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch product', error: err.message });
  }
};

// Create product
exports.createProduct = async (req, res) => {
  try {
    // Upload any new images to ImageKit
    const imageUrls = [];
    if (req.files && Array.isArray(req.files)) {
      const imageFiles = req.files.filter((file) => file.fieldname === 'images');
      for (const file of imageFiles) {
        const imageUrl = await uploadImageBuffer(file.buffer, 'romaterra/products');
        imageUrls.push(imageUrl);
      }
    }

    const { replaceImages, ...body } = pickProductFields(req.body);

    // Resolve refs: accept either an ObjectId or a name for category/collection
    const resolvedCategory = await resolveRefId(Category, body.category);
    const resolvedCollection = await resolveRefId(Collection, body.collection);

    const productData = {
      ...body,
      category: resolvedCategory,
      collection: resolvedCollection,
      images: imageUrls.length > 0 ? imageUrls : (body.images || []),
    };

    // Coerce numeric fields that may arrive as strings from multipart/form-data
    if (typeof productData.price === 'string') productData.price = parseFloat(productData.price);
    if (productData.promoPrice !== undefined && productData.promoPrice !== '' &&
        typeof productData.promoPrice === 'string') {
      productData.promoPrice = parseFloat(productData.promoPrice);
    }
    if (typeof productData.quantityInStock === 'string') {
      productData.quantityInStock = parseInt(productData.quantityInStock, 10);
    }

    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ message: 'Failed to create product', error: err.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Upload any new images to ImageKit
    const newImageUrls = [];
    if (req.files && Array.isArray(req.files)) {
      const imageFiles = req.files.filter((file) => file.fieldname === 'images');
      for (const file of imageFiles) {
        const imageUrl = await uploadImageBuffer(file.buffer, 'romaterra/products');
        newImageUrls.push(imageUrl);
      }
    }

    const { replaceImages, ...updateData } = pickProductFields(req.body);

    // Resolve refs if provided
    if (updateData.category !== undefined) {
      updateData.category = await resolveRefId(Category, updateData.category);
    }
    if (updateData.collection !== undefined) {
      updateData.collection = await resolveRefId(Collection, updateData.collection);
    }

    // Merge / replace images when new ones are uploaded
    if (newImageUrls.length > 0) {
      const existingImages = product.images || [];
      updateData.images = String(replaceImages) === 'true'
        ? newImageUrls
        : [...existingImages, ...newImageUrls];
    }

    // Coerce numeric fields when they arrive as strings
    if (typeof updateData.price === 'string') updateData.price = parseFloat(updateData.price);
    if (updateData.promoPrice !== undefined && updateData.promoPrice !== '' &&
        typeof updateData.promoPrice === 'string') {
      updateData.promoPrice = parseFloat(updateData.promoPrice);
    }
    if (typeof updateData.quantityInStock === 'string') {
      updateData.quantityInStock = parseInt(updateData.quantityInStock, 10);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    res.json(updatedProduct);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ message: 'Failed to update product', error: err.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.images && product.images.length > 0) {
      for (const imageUrl of product.images) {
        await deleteImage(imageUrl).catch(() => null);
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
};

// Update stock quantity
exports.updateProductStock = async (req, res) => {
  try {
    const quantityInStock = Number(req.body?.quantityInStock);
    if (!Number.isInteger(quantityInStock) || quantityInStock < 0) {
      return res.status(400).json({ message: 'quantityInStock must be a non-negative integer' });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { quantityInStock },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update stock', error: err.message });
  }
};
