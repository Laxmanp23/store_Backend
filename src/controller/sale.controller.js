const { Sale, SaleItem, Customer, Product, Stock, Payment, Category, sequelize } = require('../model');
const { Op } = require('sequelize');

// Create new sale
exports.createSale = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { 
            CustomerId, 
            invoiceNumber: providedInvoiceNumber, 
            items, 
            note, 
            initialPayment, 
            paymentMode,
            // GST fields
            gstEnabled,
            gstRate,
            gstType
        } = req.body;

        // Generate invoice number if not provided
        let invoiceNumber = providedInvoiceNumber;
        if (!invoiceNumber) {
            // Auto-generate: INV-YYYYMMDD-HHMMSS-RANDOM
            const now = new Date();
            const date = now.toISOString().slice(0, 10).replace(/-/g, '');
            const time = now.toISOString().slice(11, 19).replace(/:/g, '');
            const random = Math.floor(Math.random() * 10000);
            invoiceNumber = `INV-${date}-${time}-${random}`;
        }

        // Validation
        if (!CustomerId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID and at least one item are required'
            });
        }

        // Check if customer exists
        const customer = await Customer.findByPk(CustomerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Validate all products and stock
        let totalAmount = 0;
        const validatedItems = [];

        for (const item of items) {
            const { ProductId, quantity, sellingPrice } = item;

            if (!ProductId || !quantity || !sellingPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Each item must have ProductId, quantity, and sellingPrice'
                });
            }

            // Check if product exists
            const product = await Product.findByPk(ProductId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product with ID ${ProductId} not found`
                });
            }

            // Check stock availability - sum of ALL batches for this product
            const stockRecords = await Stock.findAll({
                where: { 
                    ProductId,
                    quantity: { [Op.gt]: 0 } // Only batches with stock > 0
                },
                order: [['createdAt', 'ASC']] // FIFO - oldest first
            });

            const totalAvailableStock = stockRecords.reduce((sum, s) => sum + s.quantity, 0);

            if (totalAvailableStock < quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${product.name}. Available: ${totalAvailableStock}, Required: ${quantity}`
                });
            }

            const itemTotal = quantity * sellingPrice;
            totalAmount += itemTotal;

            validatedItems.push({
                ProductId,
                quantity: parseFloat(quantity),
                sellingPrice: parseFloat(sellingPrice),
                totalPrice: parseFloat(itemTotal)
            });
        }

        // Apply GST if enabled and exclusive (add GST to total)
        if (gstEnabled && gstType === 'exclusive' && gstRate > 0) {
            const gstAmount = totalAmount * (parseFloat(gstRate) / 100);
            totalAmount = totalAmount + gstAmount;
        }
        // If GST is inclusive, totalAmount already includes tax (no change needed)

        // Validate initial payment if provided
        const paymentAmount = parseFloat(initialPayment) || 0;
        if (paymentAmount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Payment amount cannot be negative'
            });
        }
        if (paymentAmount > totalAmount) {
            return res.status(400).json({
                success: false,
                message: 'Payment amount cannot exceed total amount'
            });
        }

        // Determine payment status
        let paymentStatus = 'PENDING';
        if (paymentAmount >= totalAmount) {
            paymentStatus = 'PAID';
        } else if (paymentAmount > 0) {
            paymentStatus = 'PARTIAL';
        }

        // Create sale
        const sale = await Sale.create({
            CustomerId,
            invoiceNumber,
            totalAmount: parseFloat(totalAmount),
            totalPaid: paymentAmount,
            paymentStatus,
            note: note || null
        }, { transaction });

        // Create sale items and update stock (FIFO - oldest batch first)
        for (const item of validatedItems) {
            // Get stock batches for FIFO processing (oldest first)
            const stockBatches = await Stock.findAll({
                where: { 
                    ProductId: item.ProductId,
                    quantity: { [Op.gt]: 0 }
                },
                order: [['createdAt', 'ASC']] // Oldest first
            }, { transaction });

            // Get batch info from the first/primary stock batch being used (for Krishi Kendra)
            const primaryBatch = stockBatches[0];
            
            // Create sale item with batch info for Krishi Kendra
            await SaleItem.create({
                saleId: sale.id,
                ProductId: item.ProductId,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                totalPrice: item.totalPrice,
                // Krishi Kendra batch info (from primary stock batch)
                batchNumber: primaryBatch?.batchNumber || null,
                mfgDate: primaryBatch?.mfgDate || null,
                expiryDate: primaryBatch?.expiryDate || null,
                manufacturer: primaryBatch?.manufacturer || null
            }, { transaction });

            // Decrease stock using FIFO (oldest batch first)
            let remainingQty = item.quantity;

            for (const batch of stockBatches) {
                if (remainingQty <= 0) break;
                
                const deductQty = Math.min(batch.quantity, remainingQty);
                batch.quantity -= deductQty;
                await batch.save({ transaction });
                remainingQty -= deductQty;
            }
        }

        // Create payment record if initial payment was made
        if (paymentAmount > 0) {
            await Payment.create({
                saleId: sale.id,
                CustomerId,
                amount: paymentAmount,
                paymentMode: paymentMode || 'CASH',
                remark: 'Initial payment at sale'
            }, { transaction });
        }

        await transaction.commit();

        // Fetch complete sale details
        const saleDetails = await Sale.findByPk(sale.id, {
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile', 'address'] 
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'CategoryId'],
                            include: [{
                                model: Category,
                                attributes: ['id', 'name']
                            }]
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: paymentAmount > 0 
                ? `Sale created with initial payment of ₹${paymentAmount.toFixed(2)}`
                : 'Sale created successfully',
            data: {
                ...saleDetails.toJSON(),
                remainingBalance: saleDetails.totalAmount - saleDetails.totalPaid
            }
        });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({
            success: false,
            message: 'Error creating sale',
            error: error.message
        });
    }
};

// Get all sales with pagination
exports.getAllSales = async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', status = '', all = false } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { Op } = require('sequelize');

        // Build where clause
        let whereClause = {};
        
        if (status && ['PENDING', 'PARTIAL', 'COMPLETED'].includes(status)) {
            whereClause.paymentStatus = status;
        }

        if (search) {
            whereClause[Op.or] = [
                { invoiceNumber: { [Op.like]: `%${search}%` } }
            ];
        }

        // If all=true, return limited fields for dropdowns
        if (all === 'true' || all === true) {
            const sales = await Sale.findAll({
                include: [{ model: Customer, attributes: ['id', 'name'] }],
                order: [['createdAt', 'DESC']],
                limit: 500 // Safety limit even for all
            });
            return res.status(200).json({
                success: true,
                message: 'All sales retrieved successfully',
                data: sales
            });
        }

        const { count, rows: sales } = await Sale.findAndCountAll({
            where: whereClause,
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile', 'address'] 
                },
                {
                    model: Payment,
                    attributes: ['id', 'amount']
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'CategoryId'],
                            include: [{
                                model: Category,
                                attributes: ['id', 'name']
                            }]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            distinct: true
        });

        const salesWithLedger = sales.map(sale => {
            const actualPaid = (sale.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
            return {
                ...sale.toJSON(),
                totalPaid: actualPaid,
                remainingBalance: parseFloat(sale.totalAmount) - actualPaid,
                paidPercent: ((actualPaid / sale.totalAmount) * 100).toFixed(2)
            };
        });

        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(limit);
        const totalPages = Math.ceil(count / itemsPerPage);

        res.status(200).json({
            success: true,
            message: 'Sales retrieved successfully',
            count: count,
            data: salesWithLedger,
            pagination: {
                currentPage: currentPage,
                totalPages: totalPages,
                totalItems: count,
                itemsPerPage: itemsPerPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales',
            error: error.message
        });
    }
};

// Get sale by ID
exports.getSaleById = async (req, res) => {
    try {
        const { id } = req.params;

        const sale = await Sale.findByPk(id, {
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile', 'address'] 
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'CategoryId', 'costPrice'],
                            include: [{
                                model: Category,
                                attributes: ['id', 'name']
                            }]
                        }
                    ]
                },
                {
                    model: Payment,
                    attributes: ['id', 'amount', 'paymentMode', 'paymentDate', 'remark']
                }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }

        // Calculate actual paid from Payment records
        const actualPaid = (sale.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const remainingBalance = parseFloat(sale.totalAmount) - actualPaid;

        res.status(200).json({
            success: true,
            message: 'Sale retrieved successfully',
            data: {
                ...sale.toJSON(),
                totalPaid: actualPaid,
                remainingBalance: remainingBalance,
                paidPercent: ((actualPaid / sale.totalAmount) * 100).toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sale',
            error: error.message
        });
    }
};

// Get sales by customer
exports.getSalesByCustomer = async (req, res) => {
    try {
        const { CustomerId } = req.params;

        const customer = await Customer.findByPk(CustomerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const sales = await Sale.findAll({
            where: { CustomerId },
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile', 'address'] 
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'CategoryId'],
                            include: [{
                                model: Category,
                                attributes: ['id', 'name']
                            }]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const ledger = sales.map(sale => ({
            invoiceNumber: sale.invoiceNumber,
            date: sale.invoiceDate,
            amount: sale.totalAmount,
            paid: sale.totalPaid,
            remaining: sale.totalAmount - sale.totalPaid,
            status: sale.paymentStatus
        }));

        const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
        const totalPaid = sales.reduce((sum, s) => sum + parseFloat(s.totalPaid), 0);

        res.status(200).json({
            success: true,
            message: 'Customer sales ledger retrieved successfully',
            customer: {
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile
            },
            summary: {
                totalSales: totalSales,
                totalPaid: totalPaid,
                totalOutstanding: totalSales - totalPaid
            },
            ledger: ledger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer sales',
            error: error.message
        });
    }
};

// Get today's sales
exports.getTodaySales = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sales = await Sale.findAll({
            where: {
                invoiceDate: {
                    [Op.between]: [today, tomorrow]
                }
            },
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile', 'address'] 
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
        const totalCollected = sales.reduce((sum, s) => sum + parseFloat(s.totalPaid), 0);

        res.status(200).json({
            success: true,
            message: "Today's sales retrieved successfully",
            summary: {
                totalSales: totalSales,
                totalCollected: totalCollected,
                totalOutstanding: totalSales - totalCollected,
                count: sales.length
            },
            data: sales
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching today sales',
            error: error.message
        });
    }
};

// Sales summary/dashboard
exports.getSalesSummary = async (req, res) => {
    try {
        const sales = await Sale.findAll();

        const summary = {
            totalInvoices: sales.length,
            totalSalesAmount: sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0),
            totalCollected: sales.reduce((sum, s) => sum + parseFloat(s.totalPaid), 0),
            totalOutstanding: 0,
            byPaymentStatus: {
                pending: sales.filter(s => s.paymentStatus === 'PENDING').length,
                partial: sales.filter(s => s.paymentStatus === 'PARTIAL').length,
                completed: sales.filter(s => s.paymentStatus === 'COMPLETED').length
            }
        };

        summary.totalOutstanding = summary.totalSalesAmount - summary.totalCollected;

        res.status(200).json({
            success: true,
            message: 'Sales summary retrieved successfully',
            data: summary
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales summary',
            error: error.message
        });
    }
};
