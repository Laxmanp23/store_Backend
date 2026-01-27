const { Sale, SaleItem, Customer, Product, Stock, Payment } = require('../model');
const { Op } = require('sequelize');

// Create new sale
exports.createSale = async (req, res) => {
    try {
        const { CustomerId, invoiceNumber, items, note } = req.body;

        // Validation
        if (!CustomerId || !invoiceNumber || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID, Invoice Number, and at least one item are required'
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

        // Check if invoice number already exists
        const existingInvoice = await Sale.findOne({ where: { invoiceNumber } });
        if (existingInvoice) {
            return res.status(400).json({
                success: false,
                message: 'Invoice number already exists'
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

            // Check stock availability
            const stockRecord = await Stock.findOne({
                where: { ProductId },
                order: [['createdAt', 'ASC']]
            });

            if (!stockRecord || stockRecord.quantity < quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${product.name}. Available: ${stockRecord ? stockRecord.quantity : 0}, Required: ${quantity}`
                });
            }

            const itemTotal = quantity * sellingPrice;
            totalAmount += itemTotal;

            validatedItems.push({
                ProductId,
                quantity: parseInt(quantity),
                sellingPrice: parseFloat(sellingPrice),
                totalPrice: parseFloat(itemTotal)
            });
        }

        // Create sale
        const sale = await Sale.create({
            CustomerId,
            invoiceNumber,
            totalAmount: parseFloat(totalAmount),
            totalPaid: 0,
            paymentStatus: 'PENDING',
            note: note || null
        });

        // Create sale items and update stock
        for (const item of validatedItems) {
            // Create sale item
            await SaleItem.create({
                saleId: sale.id,
                ProductId: item.ProductId,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                totalPrice: item.totalPrice
            });

            // Decrease stock
            const stock = await Stock.findOne({ where: { ProductId: item.ProductId } });
            stock.quantity -= item.quantity;
            await stock.save();
        }

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
                            attributes: ['id', 'name', 'category'] 
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Sale created successfully',
            data: {
                ...saleDetails.toJSON(),
                remainingBalance: saleDetails.totalAmount - saleDetails.totalPaid
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating sale',
            error: error.message
        });
    }
};

// Get all sales
exports.getAllSales = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile'] 
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'category'] 
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const salesWithLedger = sales.map(sale => ({
            ...sale.toJSON(),
            remainingBalance: sale.totalAmount - sale.totalPaid,
            paidPercent: ((sale.totalPaid / sale.totalAmount) * 100).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            message: 'Sales retrieved successfully',
            count: sales.length,
            data: salesWithLedger
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
                            attributes: ['id', 'name', 'category', 'costPrice'] 
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

        res.status(200).json({
            success: true,
            message: 'Sale retrieved successfully',
            data: {
                ...sale.toJSON(),
                remainingBalance: sale.totalAmount - sale.totalPaid,
                paidPercent: ((sale.totalPaid / sale.totalAmount) * 100).toFixed(2)
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
                    attributes: ['id', 'name', 'mobile'] 
                },
                {
                    model: SaleItem,
                    include: [
                        { 
                            model: Product, 
                            attributes: ['id', 'name', 'category'] 
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
                    attributes: ['id', 'name', 'mobile'] 
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
