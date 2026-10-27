const { randomUUID: uuidv4 } = require('crypto');
const multer = require('multer');
const { ImageKit, toFile } = require("@imagekit/nodejs");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Multer memory storage for handling multipart/form-data
const storage = multer.memoryStorage();
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per image
    files: 10,
    fields: 30,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const error = new Error(`Unsupported file type: ${file.mimetype}`);
      error.statusCode = 400;
      error.publicMessage = 'Only JPEG, PNG, WebP or GIF images are allowed';
      return cb(error);
    }
    return cb(null, true);
  },
});

// Middleware for handling multiple image uploads with field name 'images'
const uploadImages = upload.array('images');

// Middleware for handling single image upload with field name 'image'
const uploadImage = upload.single('image');

// Helper function to upload a buffer to ImageKit.
// The @imagekit/nodejs v7 SDK requires the file to be wrapped with toFile()
// before passing to files.upload(). A raw Buffer will cause a connection error.
const uploadImageBuffer = async (buffer, folder = 'romaterra/products') => {
  try {
    const fileName = `${folder}/${uuidv4()}`;
    const file = await toFile(buffer, fileName);
    const result = await imagekit.files.upload(
      { file, fileName },
      { timeout: 30000, maxRetries: 1 } // 30s timeout, 1 retry
    );
    return result.url;
  } catch (error) {
    throw error;
  }
};

// Helper function to delete a file from ImageKit (by fileId or URL).
// We don't store fileId yet; deletion isn't implemented to avoid errors.
// In production, store the fileId on upload and use it for deletion.
const deleteImage = async (url) => {
  return { result: 'skipped' };
};

module.exports = {
  uploadImages, // middleware for handling multiple images
  uploadImage,  // middleware for handling single image
  uploadImageBuffer,
  deleteImage,
};
