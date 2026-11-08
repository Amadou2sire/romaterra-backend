const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch categories' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const category = await Category.create({ name: req.body.name });
        res.status(201).json(category);
    } catch (err) {
        res.status(400).json({ message: 'Failed to create category' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                message: 'Request body is empty.',
            });
        }

        const category = await Category.findByIdAndUpdate(req.params.id, { name: req.body.name }, {
            new: true,
            runValidators: true,
        });
        if (!category) return res.status(404).json({ message: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update category' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete Category' });
    }
};



