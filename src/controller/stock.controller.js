const { Stock, Product } = require('../model');

// Add new stock
exports.addStock = async (req, res) => {
    try {
        const { ProductId, purchasePrice, salePrice, quantity } = req.body;

        // Validation
        if (!ProductId || !purchasePrice || !salePrice || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Product ID, purchase price, sale price, and quantity are required'
            });
        }

        // Validate numbers
        if (isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(salePrice) || salePrice <= 0 || isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Purchase price, sale price, and quantity must be positive numbers'
            });
        }

        // Check if product exists
        const product = await Product.findByPk(ProductId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Create stock
        const stock = await Stock.create({
            ProductId,
            purchasePrice: parseFloat(purchasePrice),
            salePrice: parseFloat(salePrice),
            originalQuantity: parseInt(quantity),
            quantity: parseInt(quantity)
        });

        // Fetch stock with product details
        const stockWithProduct = await Stock.findByPk(stock.id, {
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category', 'costPrice', 'marginPercent'] 
            }]
        });

        res.status(201).json({
            success: true,
            message: 'Stock added successfully',
            data: stockWithProduct
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding stock',
            error: error.message
        });
    }
};

// Get all stock with product details (Dashboard)
exports.getAllStock = async (req, res) => {
    try {
        const stocks = await Stock.findAll({
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category', 'costPrice', 'marginPercent'] 
            }],
            order: [['createdAt', 'DESC']]
        });

        // Add calculated fields for each stock
        const stocksWithDetails = stocks.map(stock => ({
            ...stock.toJSON(),
            soldQuantity: (stock.originalQuantity || stock.quantity) - stock.quantity,
            costValue: stock.purchasePrice * stock.quantity,
            saleValue: stock.salePrice * stock.quantity,
            profit: (stock.salePrice - stock.purchasePrice) * stock.quantity,
            profitMargin: (((stock.salePrice - stock.purchasePrice) / stock.purchasePrice) * 100).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            message: 'Stock retrieved successfully',
            count: stocks.length,
            data: stocksWithDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stock',
            error: error.message
        });
    }
};

// Get stock by product ID
exports.getStockByProduct = async (req, res) => {
    try {
        const { ProductId } = req.params;

        // Check if product exists
        const product = await Product.findByPk(ProductId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const stock = await Stock.findAll({
            where: { ProductId },
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category', 'costPrice', 'marginPercent'] 
            }],
            order: [['createdAt', 'DESC']]
        });

        if (stock.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No stock found for this product'
            });
        }

        // Add calculated fields
        const stockWithDetails = stock.map(s => ({
            ...s.toJSON(),
            costValue: s.purchasePrice * s.quantity,
            saleValue: s.salePrice * s.quantity,
            profit: (s.salePrice - s.purchasePrice) * s.quantity,
            profitMargin: (((s.salePrice - s.purchasePrice) / s.purchasePrice) * 100).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            message: 'Stock retrieved successfully',
            data: stockWithDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stock',
            error: error.message
        });
    }
};

// Update stock (Edit prices or quantity)
exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { purchasePrice, salePrice, quantity } = req.body;

        const stock = await Stock.findByPk(id);
        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        // Validate numbers if provided
        if (purchasePrice && (isNaN(purchasePrice) || purchasePrice <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Purchase price must be a positive number'
            });
        }

        if (salePrice && (isNaN(salePrice) || salePrice <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Sale price must be a positive number'
            });
        }

        if (quantity && (isNaN(quantity) || quantity <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number'
            });
        }

        // Update fields
        await stock.update({
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : stock.purchasePrice,
            salePrice: salePrice ? parseFloat(salePrice) : stock.salePrice,
            quantity: quantity ? parseInt(quantity) : stock.quantity
        });

        const updatedStock = await Stock.findByPk(id, {
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category', 'costPrice', 'marginPercent'] 
            }]
        });

        res.status(200).json({
            success: true,
            message: 'Stock updated successfully',
            data: updatedStock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating stock',
            error: error.message
        });
    }
};

// Decrease stock quantity (when sale happens)
exports.decreaseStockQuantity = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantitySold } = req.body;

        if (!quantitySold || isNaN(quantitySold) || quantitySold <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity sold is required'
            });
        }

        const stock = await Stock.findByPk(id);
        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        if (stock.quantity < quantitySold) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${stock.quantity}, Requested: ${quantitySold}`
            });
        }

        // Decrease quantity
        stock.quantity -= parseInt(quantitySold);
        await stock.save();

        const updatedStock = await Stock.findByPk(id, {
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category'] 
            }]
        });

        res.status(200).json({
            success: true,
            message: 'Stock decreased successfully',
            data: updatedStock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error decreasing stock',
            error: error.message
        });
    }
};

// Get stock dashboard summary
exports.getStockSummary = async (req, res) => {
    try {
        const stocks = await Stock.findAll({
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category', 'costPrice', 'marginPercent'] 
            }],
            order: [['createdAt', 'DESC']]
        });

        const summary = {
            totalItems: stocks.length,
            totalQuantity: 0,
            totalCostValue: 0,
            totalSaleValue: 0,
            totalPotentialProfit: 0,
            stocks: stocks.map(stock => ({
                id: stock.id,
                productId: stock.productId,
                productName: stock.Product.name,
                productCategory: stock.Product.category,
                purchasePrice: stock.purchasePrice,
                salePrice: stock.salePrice,
                quantity: stock.quantity,
                costValue: stock.purchasePrice * stock.quantity,
                saleValue: stock.salePrice * stock.quantity,
                potentialProfit: (stock.salePrice - stock.purchasePrice) * stock.quantity,
                profitMargin: (((stock.salePrice - stock.purchasePrice) / stock.purchasePrice) * 100).toFixed(2)
            }))
        };

        summary.totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
        summary.totalCostValue = stocks.reduce((sum, s) => sum + (s.purchasePrice * s.quantity), 0);
        summary.totalSaleValue = stocks.reduce((sum, s) => sum + (s.salePrice * s.quantity), 0);
        summary.totalPotentialProfit = summary.totalSaleValue - summary.totalCostValue;

        res.status(200).json({
            success: true,
            message: 'Stock summary retrieved successfully',
            data: summary
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stock summary',
            error: error.message
        });
    }
};

// Delete stock
exports.deleteStock = async (req, res) => {
    try {
        const { id } = req.params;

        const stock = await Stock.findByPk(id);
        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        await stock.destroy();

        res.status(200).json({
            success: true,
            message: 'Stock deleted successfully',
            data: stock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting stock',
            error: error.message
        });
    }
};
