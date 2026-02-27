const { Vendor, Purchase, PurchaseItem, Product, Stock, sequelize } = require('../model');

// Add new vendor
exports.addVendor = async (req, res) => {
    try {
        const { name, mobile, email, address, gstNumber, companyName } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Vendor name is required'
            });
        }

        // Check if vendor already exists with same mobile
        if (mobile) {
            const existingVendor = await Vendor.findOne({ 
                where: { mobile } 
            });
            if (existingVendor) {
                return res.status(400).json({
                    success: false,
                    message: 'Vendor with this phone number already exists'
                });
            }
        }

        const vendor = await Vendor.create({
            name,
            mobile,
            email,
            address: address || '',
            gstNumber,
            companyName
        });

        res.status(201).json({
            success: true,
            message: 'Vendor added successfully',
            data: vendor
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding vendor',
            error: error.message
        });
    }
};

// Get all vendors
exports.getAllVendors = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, all } = req.query;
        
        // If all=true, return all vendors without pagination (for dropdowns)
        if (all === 'true') {
            const vendors = await Vendor.findAll({
                order: [['createdAt', 'DESC']]
            });
            return res.status(200).json({
                success: true,
                message: 'Vendors retrieved successfully',
                data: vendors
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let whereClause = {};

        // Search filter
        if (search) {
            const { Op } = require('sequelize');
            whereClause = {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { mobile: { [Op.like]: `%${search}%` } },
                    { companyName: { [Op.like]: `%${search}%` } }
                ]
            };
        }

        const { count, rows: vendors } = await Vendor.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: limitNum,
            offset: offset
        });

        res.status(200).json({
            success: true,
            message: 'Vendors retrieved successfully',
            data: vendors,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(count / limitNum),
                totalItems: count,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(count / limitNum),
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching vendors',
            error: error.message
        });
    }
};

// Get vendor by ID
exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findByPk(id, {
            include: [{
                model: Purchase,
                include: [{ model: PurchaseItem, include: [Product] }]
            }]
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Vendor retrieved successfully',
            data: vendor
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching vendor',
            error: error.message
        });
    }
};

// Update vendor
exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, email, address, gstNumber, companyName } = req.body;

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        await vendor.update({
            name: name || vendor.name,
            mobile: mobile || vendor.mobile,
            email: email || vendor.email,
            address: address || vendor.address,
            gstNumber: gstNumber || vendor.gstNumber,
            companyName: companyName || vendor.companyName
        });

        res.status(200).json({
            success: true,
            message: 'Vendor updated successfully',
            data: vendor
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating vendor',
            error: error.message
        });
    }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Check if vendor has purchases
        const purchaseCount = await Purchase.count({ where: { VendorId: id } });
        if (purchaseCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete vendor with existing purchases'
            });
        }

        await vendor.destroy();

        res.status(200).json({
            success: true,
            message: 'Vendor deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting vendor',
            error: error.message
        });
    }
};

// ==================== PURCHASE OPERATIONS ====================

// Create new purchase from vendor
exports.createPurchase = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { 
            VendorId, 
            invoiceNumber, 
            purchaseDate, 
            items, 
            paidAmount, 
            paymentMode, 
            notes 
        } = req.body;

        // Validation
        if (!VendorId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vendor ID and at least one item are required'
            });
        }

        // Check if vendor exists
        const vendor = await Vendor.findByPk(VendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.quantity * item.unitPrice;
        }

        const paid = parseFloat(paidAmount) || 0;
        const dueAmount = totalAmount - paid;
        let paymentStatus = 'unpaid';
        if (paid >= totalAmount) {
            paymentStatus = 'paid';
        } else if (paid > 0) {
            paymentStatus = 'partial';
        }

        // Create purchase
        const purchase = await Purchase.create({
            VendorId,
            invoiceNumber,
            purchaseDate: purchaseDate || new Date(),
            totalAmount,
            paidAmount: paid,
            dueAmount,
            paymentStatus,
            paymentMode,
            notes
        }, { transaction });

        // Create purchase items and update stock
        for (const item of items) {
            // Create purchase item
            await PurchaseItem.create({
                purchaseId: purchase.id,
                ProductId: item.ProductId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice
            }, { transaction });

            // Get product info for unit
            const product = await Product.findByPk(item.ProductId);
            const unit = item.unit || product?.primaryUnit || 'PCS';

            // Create NEW stock batch for this purchase (proper tracking)
            await Stock.create({
                ProductId: item.ProductId,
                VendorId: VendorId,
                PurchaseId: purchase.id,
                purchasePrice: parseFloat(item.unitPrice),
                salePrice: parseFloat(item.salePrice) || parseFloat(item.unitPrice) * 1.1,
                originalQuantity: parseFloat(item.quantity),
                quantity: parseFloat(item.quantity),
                unit: unit,
                batchNumber: invoiceNumber || `PUR-${purchase.id}`
            }, { transaction });
        }

        await transaction.commit();

        // Fetch complete purchase with items
        const completePurchase = await Purchase.findByPk(purchase.id, {
            include: [
                { model: Vendor },
                { model: PurchaseItem, include: [Product] }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Purchase created successfully',
            data: completePurchase
        });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({
            success: false,
            message: 'Error creating purchase',
            error: error.message
        });
    }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
    try {
        const purchases = await Purchase.findAll({
            include: [
                { model: Vendor },
                { model: PurchaseItem, include: [Product] }
            ],
            order: [['purchaseDate', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'Purchases retrieved successfully',
            data: purchases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching purchases',
            error: error.message
        });
    }
};

// Get purchase by ID
exports.getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;

        const purchase = await Purchase.findByPk(id, {
            include: [
                { model: Vendor },
                { model: PurchaseItem, include: [Product] }
            ]
        });

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Purchase retrieved successfully',
            data: purchase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching purchase',
            error: error.message
        });
    }
};

// Get purchases by vendor
exports.getPurchasesByVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;

        const purchases = await Purchase.findAll({
            where: { VendorId: vendorId },
            include: [
                { model: Vendor },
                { model: PurchaseItem, include: [Product] }
            ],
            order: [['purchaseDate', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'Purchases retrieved successfully',
            data: purchases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching purchases',
            error: error.message
        });
    }
};

// Update purchase payment
exports.updatePurchasePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paidAmount, paymentMode } = req.body;

        const purchase = await Purchase.findByPk(id);
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        const newPaidAmount = parseFloat(purchase.paidAmount) + parseFloat(paidAmount);
        const dueAmount = parseFloat(purchase.totalAmount) - newPaidAmount;

        let paymentStatus = 'unpaid';
        if (newPaidAmount >= parseFloat(purchase.totalAmount)) {
            paymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
            paymentStatus = 'partial';
        }

        await purchase.update({
            paidAmount: newPaidAmount,
            dueAmount: Math.max(0, dueAmount),
            paymentStatus,
            paymentMode: paymentMode || purchase.paymentMode
        });

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully',
            data: purchase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating payment',
            error: error.message
        });
    }
};

// Get vendor purchase summary
exports.getVendorPurchaseSummary = async (req, res) => {
    try {
        const { vendorId } = req.params;

        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        const purchases = await Purchase.findAll({
            where: { VendorId: vendorId }
        });

        const totalPurchases = purchases.length;
        const totalAmount = purchases.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0);
        const totalPaid = purchases.reduce((sum, p) => sum + parseFloat(p.paidAmount), 0);
        const totalDue = purchases.reduce((sum, p) => sum + parseFloat(p.dueAmount), 0);

        res.status(200).json({
            success: true,
            message: 'Vendor purchase summary retrieved',
            data: {
                vendor,
                summary: {
                    totalPurchases,
                    totalAmount,
                    totalPaid,
                    totalDue
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching summary',
            error: error.message
        });
    }
};

// Get vendor payment ledger (Tally style)
exports.getVendorLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Check if vendor exists
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Get all purchases for vendor
        const purchases = await Purchase.findAll({
            where: { VendorId: vendorId },
            include: [{ model: PurchaseItem, include: [Product] }],
            order: [['purchaseDate', 'ASC']]
        });

        // Get all direct stock entries for vendor (without Purchase)
        const directStocks = await Stock.findAll({
            where: { 
                VendorId: vendorId,
                PurchaseId: null // Only direct stock entries
            },
            include: [{ model: Product, attributes: ['id', 'name', 'variant', 'variantGroup'] }],
            order: [['createdAt', 'ASC']]
        });

        // Build ledger with proper entries
        const ledger = [];
        let runningBalance = 0;

        // Add direct stock entries (these are credit entries - we owe vendor)
        for (const stock of directStocks) {
            const stockValue = parseFloat(stock.purchasePrice) * parseFloat(stock.originalQuantity);
            const paidAmount = parseFloat(stock.paidAmount || 0);
            const dueAmount = stockValue - paidAmount;
            runningBalance += dueAmount; // Only add unpaid amount to balance
            
            const productName = stock.Product ? 
                (stock.Product.name + (stock.Product.variant ? ` (${stock.Product.variant})` : '')) : 
                'Unknown Product';
            
            // Add stock entry (Credit - we owe vendor)
            ledger.push({
                date: stock.createdAt,
                referenceId: `STK-${stock.id}`,
                stockId: stock.id,
                type: 'STOCK',
                description: `Stock: ${productName} - ${stock.originalQuantity} ${stock.unit || 'PCS'} @ ₹${stock.purchasePrice}`,
                debit: 0,
                credit: stockValue,
                balance: runningBalance,
                totalAmount: stockValue,
                totalPaid: paidAmount,
                dueAmount: dueAmount,
                paymentStatus: stock.paymentStatus || 'UNPAID'
            });

            // Add payment entry if any payment was made
            if (paidAmount > 0) {
                ledger.push({
                    date: stock.lastPaymentDate || stock.updatedAt,
                    referenceId: `STPAY-${stock.id}`,
                    stockId: stock.id,
                    type: 'PAYMENT',
                    description: `${stock.paymentMode || 'CASH'} - Payment for STK-${stock.id}`,
                    debit: paidAmount,
                    credit: 0,
                    balance: runningBalance
                });
            }
        }

        for (const purchase of purchases) {
            // Add purchase entry (Credit - we owe money to vendor)
            runningBalance += parseFloat(purchase.totalAmount);
            ledger.push({
                date: purchase.purchaseDate,
                referenceId: purchase.invoiceNumber || `PUR-${purchase.id}`,
                purchaseId: purchase.id,
                type: 'PURCHASE',
                description: `Invoice ${purchase.invoiceNumber || purchase.id}`,
                debit: 0,
                credit: parseFloat(purchase.totalAmount),
                balance: runningBalance,
                totalAmount: parseFloat(purchase.totalAmount),
                totalPaid: parseFloat(purchase.paidAmount),
                dueAmount: parseFloat(purchase.dueAmount)
            });

            // Add payment entry if any payment was made (Debit - we paid to vendor)
            if (parseFloat(purchase.paidAmount) > 0) {
                runningBalance -= parseFloat(purchase.paidAmount);
                ledger.push({
                    date: purchase.purchaseDate,
                    referenceId: `PAY-${purchase.id}`,
                    purchaseId: purchase.id,
                    type: 'PAYMENT',
                    description: `${purchase.paymentMode || 'CASH'} - Payment for ${purchase.invoiceNumber || purchase.id}`,
                    debit: parseFloat(purchase.paidAmount),
                    credit: 0,
                    balance: runningBalance
                });
            }
        }

        // Sort ledger by date
        ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Recalculate running balance after sort
        let balance = 0;
        ledger.forEach(entry => {
            balance += entry.credit - entry.debit;
            entry.balance = balance;
        });

        // Summary - include both purchases and direct stock entries
        const totalFromPurchases = purchases.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0);
        const totalFromDirectStock = directStocks.reduce((sum, s) => sum + (parseFloat(s.purchasePrice) * parseFloat(s.originalQuantity)), 0);
        const totalPurchases = totalFromPurchases + totalFromDirectStock;
        const paidForPurchases = purchases.reduce((sum, p) => sum + parseFloat(p.paidAmount), 0);
        const paidForStock = directStocks.reduce((sum, s) => sum + parseFloat(s.paidAmount || 0), 0);
        const totalPaid = paidForPurchases + paidForStock;
        const totalOutstanding = totalPurchases - totalPaid;

        res.status(200).json({
            success: true,
            message: 'Vendor payment ledger retrieved successfully',
            vendor: {
                id: vendor.id,
                name: vendor.name,
                companyName: vendor.companyName,
                mobile: vendor.mobile,
                gstNumber: vendor.gstNumber,
                address: vendor.address
            },
            summary: {
                totalPurchases,
                totalPaid,
                totalOutstanding,
                invoiceCount: purchases.length,
                directStockCount: directStocks.length
            },
            data: ledger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching vendor ledger',
            error: error.message
        });
    }
};

// Update stock payment (for direct stock entries)
exports.updateStockPayment = async (req, res) => {
    try {
        const { stockId } = req.params;
        const { paidAmount, paymentMode } = req.body;

        // Find the stock entry
        const stock = await Stock.findByPk(stockId, {
            include: [
                { model: Product, attributes: ['id', 'name', 'variant'] },
                { model: Vendor, attributes: ['id', 'name', 'companyName'] }
            ]
        });

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock entry not found'
            });
        }

        // Calculate stock value
        const stockValue = parseFloat(stock.purchasePrice) * parseFloat(stock.originalQuantity);
        const currentPaid = parseFloat(stock.paidAmount || 0);
        const newPaid = currentPaid + parseFloat(paidAmount);
        
        if (newPaid > stockValue) {
            return res.status(400).json({
                success: false,
                message: 'Payment amount exceeds stock value'
            });
        }

        // Update stock with payment info
        await stock.update({
            paidAmount: newPaid,
            paymentStatus: newPaid >= stockValue ? 'PAID' : 'PARTIAL',
            paymentMode: paymentMode || 'CASH',
            lastPaymentDate: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Stock payment recorded successfully',
            data: {
                stockId: stock.id,
                stockValue,
                totalPaid: newPaid,
                dueAmount: stockValue - newPaid,
                paymentStatus: stock.paymentStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating stock payment',
            error: error.message
        });
    }
};
