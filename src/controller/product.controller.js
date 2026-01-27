const { Product, Stock } = require('../model');

// Add new product
exports.addProduct = async (req, res) => {
    try {
        const { name, category, description, costPrice, marginPercent } = req.body;

        // Validation
        if (!name || !category || !costPrice) {
            return res.status(400).json({
                success: false,
                message: 'Product name, category, and costPrice are required'
            });
        }

        // Validate costPrice is positive
        if (isNaN(costPrice) || costPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Cost price must be a positive number'
            });
        }

        // Check if product already exists
        const existingProduct = await Product.findOne({ where: { name } });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product already exists'
            });
        }

        // Create product
        const product = await Product.create({
            name,
            category,
            description: description || '',
            costPrice: parseFloat(costPrice),
            marginPercent: marginPercent ? parseFloat(marginPercent) : 20  // Default 20% margin
        });

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding product',
            error: error.message
        });
    }
};

// Get all products
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            attributes: ['id', 'name', 'category', 'description', 'costPrice', 'marginPercent', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'Products retrieved successfully',
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
};

// Get product by ID
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id, {
            include: [
                {
                    model: Stock,
                    attributes: ['id', 'purchasePrice', 'salePrice', 'quantity'],
                    required: false
                }
            ]
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product retrieved successfully',
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
};

// Update product
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, description, costPrice, marginPercent } = req.body;

        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Validate costPrice if provided
        if (costPrice && (isNaN(costPrice) || costPrice <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Cost price must be a positive number'
            });
        }

        // Update fields
        await product.update({
            name: name || product.name,
            category: category || product.category,
            description: description !== undefined ? description : product.description,
            costPrice: costPrice ? parseFloat(costPrice) : product.costPrice,
            marginPercent: marginPercent ? parseFloat(marginPercent) : product.marginPercent
        });

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
};

// Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        console.log('Deleting product:', product.name);
        await product.destroy();
        console.log('Product deleted successfully');

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully',
            data: product
        });
    } catch (error) {
        console.error('Delete error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error.message
        });
    }
};
