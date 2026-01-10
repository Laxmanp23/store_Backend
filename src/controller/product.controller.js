const { Product, Stock } = require('../model');

// Add new product
exports.addProduct = async (req, res) => {
    try {
        const { name, category, description } = req.body;

        // Validation
        if (!name || !category) {
            return res.status(400).json({
                success: false,
                message: 'Product name and category are required'
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

        // Create product without auto stock
        const product = await Product.create({
            name,
            category,
            description: description || ''
        });

        res.status(201).json({
            success: true,
            message: 'Product added successfully. Add stock from Stock Management page.',
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
        const products = await Product.findAll();

        res.status(200).json({
            success: true,
            message: 'Products retrieved successfully',
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

        const product = await Product.findByPk(id);
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

// Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Delete request received for ID:', id);

        const product = await Product.findByPk(id);
        if (!product) {
            console.log('Product not found with ID:', id);
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
