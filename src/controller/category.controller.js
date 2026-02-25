const { Category, Product } = require('../model');

// Add new category
exports.addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Validation
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        // Check if category already exists
        const existingCategory = await Category.findOne({ 
            where: { name: name.trim() } 
        });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        // Create category
        const category = await Category.create({
            name: name.trim(),
            description: description?.trim() || null
        });

        res.status(201).json({
            success: true,
            message: "Category added successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error adding category",
            error: error.message
        });
    }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            where: { isActive: true },
            order: [['name', 'ASC']]
        });

        res.status(200).json({
            success: true,
            message: "Categories retrieved successfully",
            count: categories.length,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching categories",
            error: error.message
        });
    }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category retrieved successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching category",
            error: error.message
        });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Check if new name already exists (exclude current category)
        if (name && name.trim() !== category.name) {
            const existingCategory = await Category.findOne({
                where: { name: name.trim() }
            });
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: "Category with this name already exists"
                });
            }
        }

        // Update category
        await category.update({
            name: name?.trim() || category.name,
            description: description?.trim() || category.description,
            isActive: isActive !== undefined ? isActive : category.isActive
        });

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating category",
            error: error.message
        });
    }
};

// Delete category (soft delete via isActive)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Check if any products use this category
        const productCount = await Product.count({ where: { CategoryId: id } });
        if (productCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. ${productCount} product(s) are using this category`
            });
        }

        // Soft delete
        await category.update({ isActive: false });

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting category",
            error: error.message
        });
    }
};
