const { Product, Stock, Vendor, ProductVendor, Category } = require('../model');


//add product
exports.addProduct = async (req, res) => {
    try {
        const { name, CategoryId, sku, description, primaryUnit, costPrice, marginPercent, imageUrl } = req.body;

        // Validation - check required fields
        if (!name || !CategoryId) {
            return res.status(400).json({
                success: false,
                message: "Product Name and Category are required"
            });
        }

        // Validate cost price if provided
        if (costPrice && (Number.isNaN(costPrice) || costPrice <= 0)) {
            return res.status(400).json({
                success: false,
                message: "Cost Price must be a Positive Number"
            });
        }

        // Validate margin percent if provided
        if (marginPercent && (Number.isNaN(marginPercent) || marginPercent < 0 || marginPercent > 1000)) {
            return res.status(400).json({
                success: false,
                message: "Margin Percent must be between 0 and 1000"
            });
        }

        // Check if product with same name already exists
        const existingProduct = await Product.findOne({ where: { name } });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        // Check if SKU already exists (if provided)
        if (sku) {
            const existingSku = await Product.findOne({ where: { sku } });
            if (existingSku) {
                return res.status(400).json({
                    success: false,
                    message: "Product with this SKU already exists"
                });
            }
        }

        // Verify category exists
        const categoryExists = await Category.findByPk(CategoryId);
        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                message: "Selected category does not exist"
            });
        }

        const product = await Product.create({
            name: name.trim(),
            CategoryId: CategoryId,
            sku: sku ? sku.trim() : null,
            description: description ? description.trim() : null,
            primaryUnit: primaryUnit || 'PCS',
            costPrice: costPrice ? parseFloat(costPrice) : null,
            marginPercent: marginPercent ? parseFloat(marginPercent) : null,
            imageUrl: imageUrl || null,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: "Product created successfully!",
            data: product
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating product",
            error: error.message
        });
    }
};

// Get all products with pagination
exports.getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', category = '', all = false } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { Op } = require('sequelize');

        // Build where clause
        let whereClause = { isActive: true };
        
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { sku: { [Op.like]: `%${search}%` } }
            ];
        }
        
        if (category) {
            whereClause.CategoryId = parseInt(category);
        }

        // If all=true, return all products for dropdowns
        if (all === 'true' || all === true) {
            const products = await Product.findAll({
                attributes: ['id', 'name', 'sku', 'CategoryId', 'primaryUnit', 'costPrice', 'marginPercent'],
                where: { isActive: true },
                include: [{ model: Category, attributes: ['id', 'name'] }],
                order: [['name', 'ASC']]
            });
            return res.status(200).json({
                success: true,
                message: 'All products retrieved successfully',
                data: products
            });
        }

        const { count, rows: products } = await Product.findAndCountAll({
            attributes: ['id', 'name', 'sku', 'CategoryId', 'description', 'primaryUnit', 'costPrice', 'marginPercent', 'imageUrl', 'isActive', 'createdAt', 'updatedAt'],
            where: whereClause,
            include: [{
                model: Category,
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            distinct: true
        });

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const totalPages = Math.ceil(count / limitNum);

        res.status(200).json({
            success: true,
            message: 'Products retrieved successfully',
            count: count,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalItems: count,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
};

// Get all products (including inactive)
exports.getAllProductsIncludeInactive = async (req, res) => {
    try {
        const products = await Product.findAll({
            attributes: ['id', 'name', 'sku', 'CategoryId', 'description', 'costPrice', 'marginPercent', 'imageUrl', 'isActive', 'createdAt', 'updatedAt'],
            include: [{
                model: Category,
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'All products retrieved successfully',
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
            attributes: ['id', 'name', 'sku', 'CategoryId', 'description', 'costPrice', 'marginPercent', 'imageUrl', 'isActive', 'createdAt', 'updatedAt'],
            include: [{
                model: Category,
                attributes: ['id', 'name']
            },
                {
                    model: Stock,
                    attributes: ['id', 'purchasePrice', 'salePrice', 'quantity', 'VendorId', 'batchNumber', 'expiryDate'],
                    include: [
                        {
                            model: Vendor,
                            attributes: ['id', 'name']
                        }
                    ],
                    required: false
                },
                {
                    model: Vendor,
                    as: 'Vendors',
                    attributes: ['id', 'name', 'email', 'mobile'],
                    through: { attributes: ['vendorProductCode', 'minimumOrderQty', 'leadTimeDays', 'isPreferredVendor'] },
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
        const { name, CategoryId, sku, description, primaryUnit, costPrice, marginPercent, imageUrl, isActive } = req.body;

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

        // Validate marginPercent if provided
        if (marginPercent && (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 1000)) {
            return res.status(400).json({
                success: false,
                message: 'Margin percent must be between 0 and 1000'
            });
        }

        // Check if new name already exists (if being updated and different)
        if (name && name !== product.name) {
            const existingName = await Product.findOne({ where: { name } });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: 'Product with this name already exists'
                });
            }
        }

        // Check if new SKU already exists (if being updated and different)
        if (sku && sku !== product.sku) {
            const existingSku = await Product.findOne({ where: { sku } });
            if (existingSku) {
                return res.status(400).json({
                    success: false,
                    message: 'Product with this SKU already exists'
                });
            }
        }

        // Verify category exists (if CategoryId is being updated)
        if (CategoryId && CategoryId !== product.CategoryId) {
            const categoryExists = await Category.findByPk(CategoryId);
            if (!categoryExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected category does not exist'
                });
            }
        }

        // Update fields
        await product.update({
            name: name ? name.trim() : product.name,
            CategoryId: CategoryId !== undefined ? CategoryId : product.CategoryId,
            sku: sku ? sku.trim() : product.sku,
            description: description !== undefined ? (description ? description.trim() : null) : product.description,
            primaryUnit: primaryUnit || product.primaryUnit || 'PCS',
            costPrice: costPrice ? parseFloat(costPrice) : product.costPrice,
            marginPercent: marginPercent !== undefined ? parseFloat(marginPercent) : product.marginPercent,
            imageUrl: imageUrl !== undefined ? imageUrl : product.imageUrl,
            isActive: isActive !== undefined ? isActive : product.isActive
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

// ==================== VENDOR MANAGEMENT ====================

// Add vendor to product
exports.addVendorToProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { VendorId, vendorProductCode, minimumOrderQty, leadTimeDays, isPreferredVendor } = req.body;

        // Validate product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Validate vendor exists
        const vendor = await Vendor.findByPk(VendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Check if already exists
        const existing = await ProductVendor.findOne({
            where: { ProductId: productId, VendorId }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'This vendor is already linked to this product'
            });
        }

        // If marking as preferred, unmark others
        if (isPreferredVendor) {
            await ProductVendor.update(
                { isPreferredVendor: false },
                { where: { ProductId: productId } }
            );
        }

        // Create relationship
        const productVendor = await ProductVendor.create({
            ProductId: productId,
            VendorId,
            vendorProductCode: vendorProductCode || null,
            minimumOrderQty: minimumOrderQty || 1,
            leadTimeDays: leadTimeDays || null,
            isPreferredVendor: isPreferredVendor || false
        });

        // Fetch complete product with vendors
        const updated = await Product.findByPk(productId, {
            include: [{
                model: Vendor,
                as: 'Vendors',
                through: { attributes: ['vendorProductCode', 'minimumOrderQty', 'leadTimeDays', 'isPreferredVendor'] }
            }]
        });

        res.status(201).json({
            success: true,
            message: 'Vendor added to product successfully',
            data: updated
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding vendor to product',
            error: error.message
        });
    }
};

// Remove vendor from product
exports.removeVendorFromProduct = async (req, res) => {
    try {
        const { productId, vendorId } = req.params;

        // Validate product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Remove relationship
        const deleted = await ProductVendor.destroy({
            where: { ProductId: productId, VendorId: vendorId }
        });

        if (deleted === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not linked to this product'
            });
        }

        // Fetch updated product
        const updated = await Product.findByPk(productId, {
            include: [{
                model: Vendor,
                as: 'Vendors',
                through: { attributes: ['vendorProductCode', 'minimumOrderQty', 'leadTimeDays', 'isPreferredVendor'] }
            }]
        });

        res.status(200).json({
            success: true,
            message: 'Vendor removed from product successfully',
            data: updated
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing vendor from product',
            error: error.message
        });
    }
};

// Get product vendors
exports.getProductVendors = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findByPk(productId, {
            include: [{
                model: Vendor,
                as: 'Vendors',
                through: { attributes: ['vendorProductCode', 'minimumOrderQty', 'leadTimeDays', 'isPreferredVendor'] }
            }]
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product vendors retrieved successfully',
            data: {
                product: {
                    id: product.id,
                    name: product.name,
                    category: product.category
                },
                vendors: product.Vendors || []
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product vendors',
            error: error.message
        });
    }
};

// Update vendor for product
exports.updateProductVendor = async (req, res) => {
    try {
        const { productId, vendorId } = req.params;
        const { vendorProductCode, minimumOrderQty, leadTimeDays, isPreferredVendor } = req.body;

        // Validate product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find relationship
        const productVendor = await ProductVendor.findOne({
            where: { ProductId: productId, VendorId: vendorId }
        });

        if (!productVendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not linked to this product'
            });
        }

        // If marking as preferred, unmark others
        if (isPreferredVendor) {
            await ProductVendor.update(
                { isPreferredVendor: false },
                { where: { ProductId: productId } }
            );
        }

        // Update
        await productVendor.update({
            vendorProductCode: vendorProductCode !== undefined ? vendorProductCode : productVendor.vendorProductCode,
            minimumOrderQty: minimumOrderQty || productVendor.minimumOrderQty,
            leadTimeDays: leadTimeDays !== undefined ? leadTimeDays : productVendor.leadTimeDays,
            isPreferredVendor: isPreferredVendor !== undefined ? isPreferredVendor : productVendor.isPreferredVendor
        });

        // Fetch updated product
        const updated = await Product.findByPk(productId, {
            include: [{
                model: Vendor,
                as: 'Vendors',
                through: { attributes: ['vendorProductCode', 'minimumOrderQty', 'leadTimeDays', 'isPreferredVendor'] }
            }]
        });

        res.status(200).json({
            success: true,
            message: 'Product vendor updated successfully',
            data: updated
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating product vendor',
            error: error.message
        });
    }
};

