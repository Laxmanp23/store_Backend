const { Stock, Product, Vendor, Purchase, Category } = require('../model');

// Add new stock
exports.addStock = async (req, res) => {
    try {
        const { ProductId, purchasePrice, salePrice, quantity, VendorId, PurchaseId, batchNumber, expiryDate } = req.body;

        // Validation - Required fields
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

        // Validate that sale price is greater than purchase price
        if (parseFloat(salePrice) <= parseFloat(purchasePrice)) {
            return res.status(400).json({
                success: false,
                message: 'Sale Price must be greater than Purchase Price'
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

        // If VendorId provided, validate vendor exists
        if (VendorId) {
            const vendor = await Vendor.findByPk(VendorId);
            if (!vendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }
        }

        // If PurchaseId provided, validate purchase exists
        if (PurchaseId) {
            const purchase = await Purchase.findByPk(PurchaseId);
            if (!purchase) {
                return res.status(404).json({
                    success: false,
                    message: 'Purchase not found'
                });
            }
        }

        // Create stock with vendor and batch information
        const stock = await Stock.create({
            ProductId,
            VendorId: VendorId || null,
            PurchaseId: PurchaseId || null,
            purchasePrice: parseFloat(purchasePrice),
            salePrice: parseFloat(salePrice),
            originalQuantity: parseInt(quantity),
            quantity: parseInt(quantity),
            batchNumber: batchNumber || null,
            expiryDate: expiryDate ? new Date(expiryDate) : null
        });

        // Fetch stock with product and vendor details
        const stockWithDetails = await Stock.findByPk(stock.id, {
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'mobile', 'companyName'],
                    required: false
                },
                {
                    model: Purchase,
                    attributes: ['id', 'invoiceNumber', 'purchaseDate'],
                    required: false
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Stock added successfully',
            data: stockWithDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding stock',
            error: error.message
        });
    }
};

// Get all stock with product details (Dashboard) - with pagination
exports.getAllStock = async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', lowStock = false, all = false } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { Op } = require('sequelize');

        // Build where clause
        let whereClause = {};
        
        // Filter low stock (quantity <= 10)
        if (lowStock === 'true' || lowStock === true) {
            whereClause.quantity = { [Op.lte]: 10, [Op.gt]: 0 };
        }

        // If all=true, return all stocks (for calculations/reports)
        if (all === 'true' || all === true) {
            const stocks = await Stock.findAll({
                include: [
                    { 
                        model: Product, 
                        attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                        include: [{
                            model: Category,
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: Vendor,
                        attributes: ['id', 'name', 'companyName'],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            const stocksWithDetails = stocks.map(stock => ({
                ...stock.toJSON(),
                vendorName: stock.Vendor ? stock.Vendor.name : 'Not assigned',
                soldQuantity: (parseFloat(stock.originalQuantity) || parseFloat(stock.quantity)) - parseFloat(stock.quantity),
                costValue: parseFloat(stock.purchasePrice) * parseFloat(stock.quantity),
                saleValue: parseFloat(stock.salePrice) * parseFloat(stock.quantity)
            }));

            return res.status(200).json({
                success: true,
                message: 'All stock retrieved successfully',
                count: stocks.length,
                data: stocksWithDetails
            });
        }

        const { count, rows: stocks } = await Stock.findAndCountAll({
            where: whereClause,
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'companyName'],
                    required: false
                },
                {
                    model: Purchase,
                    attributes: ['id', 'invoiceNumber'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            distinct: true
        });

        // Add calculated fields for each stock
        const stocksWithDetails = stocks.map(stock => ({
            ...stock.toJSON(),
            vendorName: stock.Vendor ? stock.Vendor.name : 'Not assigned',
            purchaseInvoice: stock.Purchase ? stock.Purchase.invoiceNumber : 'Not assigned',
            soldQuantity: (parseFloat(stock.originalQuantity) || parseFloat(stock.quantity)) - parseFloat(stock.quantity),
            costValue: parseFloat(stock.purchasePrice) * parseFloat(stock.quantity),
            saleValue: parseFloat(stock.salePrice) * parseFloat(stock.quantity),
            profit: (parseFloat(stock.salePrice) - parseFloat(stock.purchasePrice)) * parseFloat(stock.quantity),
            profitMargin: (((parseFloat(stock.salePrice) - parseFloat(stock.purchasePrice)) / parseFloat(stock.purchasePrice)) * 100).toFixed(2)
        }));

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const totalPages = Math.ceil(count / limitNum);

        res.status(200).json({
            success: true,
            message: 'Stock retrieved successfully',
            count: count,
            data: stocksWithDetails,
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
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'companyName'],
                    required: false
                },
                {
                    model: Purchase,
                    attributes: ['id', 'invoiceNumber'],
                    required: false
                }
            ],
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
            vendorName: s.Vendor ? s.Vendor.name : 'Not assigned',
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
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'companyName'],
                    required: false
                },
                {
                    model: Purchase,
                    attributes: ['id', 'invoiceNumber'],
                    required: false
                }
            ]
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
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }] 
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'companyName'],
                    required: false
                }
            ]
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
            include: [
                { 
                    model: Product, 
                    attributes: ['id', 'name', 'CategoryId', 'costPrice', 'marginPercent'],
                    include: [{
                        model: Category,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Vendor,
                    attributes: ['id', 'name', 'companyName'],
                    required: false
                },
                {
                    model: Purchase,
                    attributes: ['id', 'invoiceNumber'],
                    required: false
                }
            ],
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
                productCategory: stock.Product.Category ? stock.Product.Category.name : 'N/A',
                vendorId: stock.VendorId,
                vendorName: stock.Vendor ? stock.Vendor.name : 'Not assigned',
                batchNumber: stock.batchNumber,
                expiryDate: stock.expiryDate,
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
