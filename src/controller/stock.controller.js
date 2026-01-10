const { Stock, Product } = require('../model');

// Add new stock
exports.addStock = async (req, res) => {
    try {
        const { productId, purchasePrice, quantity } = req.body;

        // Validation
        if (!productId || !purchasePrice || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Product ID, purchase price, and quantity are required'
            });
        }

        // Check if product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Create stock
        const stock = await Stock.create({
            ProductId: productId,
            purchasePrice,
            quantity,
            remainingQty: quantity
        });

        // Fetch stock with product details
        const stockWithProduct = await Stock.findByPk(stock.id, {
            include: [{ model: Product, attributes: ['name', 'category'] }]
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
                attributes: [ 'name', 'category'] 
            }]
            
        });

        // Add total price calculation for each stock
        const stocksWithTotalPrice = stocks.map(stock => ({
            ...stock.toJSON(),
            totalPrice: stock.purchasePrice * stock.quantity
        }));

        res.status(200).json({
            success: true,
            message: 'Stock retrieved successfully',
            data: stocksWithTotalPrice
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
        const { productId } = req.params;

        const stock = await Stock.findAll({
            where: { ProductId: productId },
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category'] 
            }]
        });

        if (stock.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No stock found for this product'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Stock retrieved successfully',
            data: stock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stock',
            error: error.message
        });
    }
};

// Update stock quantity (when stock is sold)
exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantitySold } = req.body;

        if (!quantitySold) {
            return res.status(400).json({
                success: false,
                message: 'Quantity sold is required'
            });
        }

        const stock = await Stock.findByPk(id);
        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        if (stock.remainingQty < quantitySold) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock available'
            });
        }

        stock.remainingQty -= quantitySold;
        await stock.save();

        const updatedStock = await Stock.findByPk(id, {
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category'] 
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

// Get stock dashboard summary
exports.getStockSummary = async (req, res) => {
    try {
        const stocks = await Stock.findAll({
            include: [{ 
                model: Product, 
                attributes: ['id', 'name', 'category'] 
            }]
        });

        const summary = {
            totalProducts: stocks.length,
            totalQuantity: 0,
            totalRemainingQty: 0,
            totalValue: 0,
            stocks: stocks.map(stock => ({
                id: stock.id,
                productName: stock.Product.name,
                productCategory: stock.Product.category,
                purchasePrice: stock.purchasePrice,
                quantity: stock.quantity,
                remainingQty: stock.remainingQty,
                totalValue: stock.purchasePrice * stock.quantity
            }))
        };

        summary.totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
        summary.totalRemainingQty = stocks.reduce((sum, s) => sum + s.remainingQty, 0);
        summary.totalValue = stocks.reduce((sum, s) => sum + (s.purchasePrice * s.quantity), 0);

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
