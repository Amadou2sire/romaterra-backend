const Collection = require('../models/Collection');
const mongoose = require('mongoose');
const { deleteImage, uploadImageBuffer } = require('../utils/uploadUtils');

exports.getCollections = async (req, res) => {
  try {
    const collections = await Collection.find().populate('products');
    res.json(collections);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch collections', error: err.message });
  }
};

exports.getCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id).populate('products');
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    res.json(collection);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch collection', error: err.message });
  }
};

// Helper : normalise un champ "products" qui peut arriver sous 4 formes
// depuis un FormData (axios + FormData).
// 1) "products" présent comme string CSV : "id1,id2,id3"
// 2) "products" présent comme string JSON : '["id1","id2"]'
// 3) "products[]" envoyé N fois par append : req.body["products[]"]
// 4) "products" envoyé N fois (FormData répété) : req.body.products peut être string ou array
// On retourne toujours un array de strings (ou []).
const parseProductsField = (body) => {
  const raw = body?.products ?? body?.['products[]'];
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.filter((v) => v !== '' && v !== null && v !== undefined);
  }
  if (typeof raw === 'string') {
    // JSON ?
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((v) => typeof v === 'string' && v.length > 0);
        }
      } catch (_) {
        // Pas du JSON → CSV
      }
    }
    // CSV fallback
    return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
};

exports.createCollection = async (req, res) => {
  try {
    // Access fields safely
    const name = req.body?.name;
    const description = req.body?.description;
    const image = req.body?.image;
    const productIds = parseProductsField(req.body);

    // Validate required fields
    if (!name || (typeof name === 'string' && !name.trim())) {
      return res.status(400).json({ message: 'Collection name is required' });
    }

    // Validate product IDs (si au moins un fourni)
    for (const id of productIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid product ID format: ${id}` });
      }
    }

    // Handle image field: prioritize uploaded file, then use image URL from body
    let imageUrl = undefined;
    if (req.file) {
      // Upload file buffer to ImageKit
      try {
        imageUrl = await uploadImageBuffer(req.file.buffer, 'romaterra/collections');
      } catch (uploadErr) {
        return res.status(400).json({ message: 'Failed to upload image' });
      }
    } else if (image) {
      imageUrl = image.trim(); // Use URL from body if provided
    }

    // Prepare collection data
    const collectionData = {
      name: typeof name === 'string' ? name.trim() : name,
      description: description && typeof description === 'string' ? description.trim() : description,
      image: imageUrl,
      products: productIds,
    };

    const collection = await Collection.create(collectionData);
    res.status(201).json(collection);
  } catch (err) {
    // Handle duplicate key error (unique constraint)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'collection name already exists' });
    }
    res.status(400).json({ message: 'Failed to create collection' });
  }
};

exports.updateCollection = async (req, res) => {
  try {
    // Ensure req.body exists (multer should populate it, but add safety check)
    const body = req.body || {};
    const { name, description, image } = body;
    // "products" peut être [] envoyé par le front = "aucun produit".
    // On l'accepte SEULEMENT si la clé est présente dans le FormData.
    const productsKeyPresent = body.products !== undefined || body['products[]'] !== undefined;
    const productIds = productsKeyPresent ? parseProductsField(body) : undefined;
    const collection = await Collection.findById(req.params.id);

    if (!collection) return res.status(404).json({ message: 'collection not found' });

    // Build update object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'collection name cannot be empty' });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : undefined;
    }

    if (productIds !== undefined) {
      for (const id of productIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: `Invalid product ID format: ${id}` });
        }
      }
      updateData.products = productIds;
    }

    // Handle image field - prioritize uploaded file, then use image URL from body
    if (req.file) {
      // Delete old image from ImageKit if it exists (note: ImageKit deletion not fully implemented)
      if (collection.image) {
        try {
          // Note: ImageKit deletion requires fileId, which we're not storing
          // For now, we log a warning and skip deletion
          await deleteImage(collection.image);
        } catch (err) {
          console.error('Error deleting old collection image:', err);
        }
      }
      // Upload new file buffer to ImageKit
      try {
        updateData.image = await uploadImageBuffer(req.file.buffer, 'romaterra/collections');
      } catch (uploadErr) {
        return res.status(400).json({ message: 'Failed to upload image' });
      }
    } else if (image !== undefined) {
      // If image is explicitly set (including empty string to remove), handle it
      if (image === '' || image === null) {
        // Delete old image if removing it (note: ImageKit deletion not fully implemented)
        if (collection.image) {
          try {
            // Note: ImageKit deletion requires fileId, which we're not storing
            // For now, we log a warning and skip deletion
            await deleteImage(collection.image);
          } catch (err) {
            console.error('Error deleting old collection image:', err);
          }
        }
        updateData.image = undefined;
      } else if (image && image.trim()) {
        // Only update if new image URL is different from current
        if (image.trim() !== collection.image) {
          // Delete old image from ImageKit if it exists (note: ImageKit deletion not fully implemented)
          if (collection.image) {
            try {
              // Note: ImageKit deletion requires fileId, which we're not storing
              // For now, we log a warning and skip deletion
              await deleteImage(collection.image);
            } catch (err) {
              console.error('Error deleting old collection image:', err);
            }
          }
          updateData.image = image.trim();
        }
      }
    }

    const updatedCollection = await Collection.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    res.json(updatedCollection);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update Collection' });
  }
};

exports.deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'collection not found' });

    // Delete image from ImageKit if it exists (note: ImageKit deletion not fully implemented)
    if (collection.image) {
      try {
        // Note: ImageKit deletion requires fileId, which we're not storing
        // For now, we log a warning and skip deletion
        await deleteImage(collection.image);
      } catch (err) {
        console.error('Error deleting collection image:', err);
      }
    }

    await Collection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Collection deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete Collection' });
  }
};