const { Sale, Customer, Stock, Product } = require('../model');
const { Op } = require('sequelize');

// Create new sale
exports.createSale = async (req, res) => {
    try {
        const { customerId, productId, quantity, sellingPrice, paidAmount } = req.body;

        // Validation
        if (!customerId || !productId || !quantity || !sellingPrice) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID, Product ID, quantity, and selling price are required'
            });
        }

        // Check if customer exists
        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
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

        // Check total available stock for this product (all batches combined)
        const allStocks = await Stock.findAll({ 
            where: { ProductId: productId },
            order: [['createdAt', 'ASC']] // FIFO - oldest stock first
        });
        
        const totalAvailableQty = allStocks.reduce((sum, s) => sum + s.remainingQty, 0);
        if (totalAvailableQty < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${totalAvailableQty}`
            });
        }

        // Create sale with ProductId and calculate totalPrice
        const totalPrice = quantity * sellingPrice;
        const actualPaidAmount = paidAmount && !isNaN(paidAmount) ? Math.max(0, parseFloat(paidAmount)) : 0;
        
        // Validate that paid amount doesn't exceed total price
        if (actualPaidAmount > totalPrice) {
            return res.status(400).json({
                success: false,
                message: `Paid amount (${actualPaidAmount}) cannot exceed total price (${totalPrice})`
            });
        }

        const sale = await Sale.create({
            CustomerId: customerId,
            ProductId: productId,
            quantity,
            sellingPrice,
            totalPrice,
            paidAmount: actualPaidAmount
        });

        // Decrease stock quantity from oldest batches first (FIFO)
        let remainingQtyToDeduct = quantity;
        for (const stock of allStocks) {
            if (remainingQtyToDeduct <= 0) break;
            
            const deductAmount = Math.min(stock.remainingQty, remainingQtyToDeduct);
            stock.remainingQty -= deductAmount;
            await stock.save();
            remainingQtyToDeduct -= deductAmount;
        }

        // Fetch sale with customer and product details
        const saleDetails = await Sale.findByPk(sale.id, {
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price', 'quantity'] }
            ]
        });

        // Calculate due amount
        const dueAmount = parseFloat(saleDetails.totalPrice) - parseFloat(saleDetails.paidAmount);

        res.status(201).json({
            success: true,
            message: 'Sale created successfully',
            data: {
                ...saleDetails.toJSON(),
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : (actualPaidAmount > 0 ? 'Partial Payment' : 'Unpaid')
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
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add payment details to each sale
        const salesWithPayment = sales.map(sale => {
            const dueAmount = parseFloat(sale.totalPrice) - parseFloat(sale.paidAmount || 0);
            const paidAmount = parseFloat(sale.paidAmount || 0);
            return {
                ...sale.toJSON(),
                paidAmount: paidAmount,
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : (paidAmount > 0 ? 'Partial Payment' : 'Unpaid')
            };
        });

        res.status(200).json({
            success: true,
            message: 'Sales retrieved successfully',
            data: salesWithPayment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales',
            error: error.message
        });
    }
};
// Get today's sales
exports.getTodaySales = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const sales = await Sale.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add payment details to each sale
        const salesWithPayment = sales.map(sale => {
            const dueAmount = parseFloat(sale.totalPrice) - parseFloat(sale.paidAmount || 0);
            const paidAmount = parseFloat(sale.paidAmount || 0);
            return {
                ...sale.toJSON(),
                paidAmount: paidAmount,
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : (paidAmount > 0 ? 'Partial Payment' : 'Unpaid')
            };
        });

        res.status(200).json({
            success: true,
            message: 'Today sales retrieved successfully',
            data: salesWithPayment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching today sales',
            error: error.message
        });
    }
};

// Get sales by customer
exports.getSalesByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const sales = await Sale.findAll({
            where: { CustomerId: customerId },
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add payment details to each sale
        const salesWithPayment = sales.map(sale => {
            const dueAmount = parseFloat(sale.totalPrice) - parseFloat(sale.paidAmount || 0);
            const paidAmount = parseFloat(sale.paidAmount || 0);
            return {
                ...sale.toJSON(),
                paidAmount: paidAmount,
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : (paidAmount > 0 ? 'Partial Payment' : 'Unpaid')
            };
        });

        res.status(200).json({
            success: true,
            message: 'Customer sales retrieved successfully',
            customerName: customer.name,
            data: salesWithPayment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales',
            error: error.message
        });
    }
};

// Get sales by date range
exports.getSalesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const sales = await Sale.findAll({
            where: {
                createdAt: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            },
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'Sales retrieved successfully',
            data: sales
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales',
            error: error.message
        });
    }
};

// Get sales dashboard/report
exports.getSalesReport = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { model: Customer, attributes: ['id', 'name', 'mobile'] },
                { 
                    model: Stock, 
                    attributes: ['id', 'purchasePrice', 'quantity', 'remainingQty'],
                    include: [{ model: Product, attributes: ['id', 'name', 'category'] }]
                }
            ]
        });

        const report = {
            totalSales: sales.length,
            totalRevenue: 0,
            totalProfit: 0,
            totalQuantitySold: 0,
            salesByProduct: {},
            salesByCustomer: {},
            sales: []
        };

        sales.forEach(sale => {
            const revenue = sale.quantity * sale.sellingPrice;
            const cost = sale.quantity * sale.Stock.purchasePrice;
            const profit = revenue - cost;

            report.totalRevenue += revenue;
            report.totalProfit += profit;
            report.totalQuantitySold += sale.quantity;

            // By product
            const productName = sale.Stock.Product.name;
            if (!report.salesByProduct[productName]) {
                report.salesByProduct[productName] = {
                    quantity: 0,
                    revenue: 0,
                    profit: 0
                };
            }
            report.salesByProduct[productName].quantity += sale.quantity;
            report.salesByProduct[productName].revenue += revenue;
            report.salesByProduct[productName].profit += profit;

            // By customer
            const customerName = sale.Customer.name;
            if (!report.salesByCustomer[customerName]) {
                report.salesByCustomer[customerName] = {
                    totalSales: 0,
                    totalAmount: 0,
                    totalQuantity: 0
                };
            }
            report.salesByCustomer[customerName].totalSales += 1;
            report.salesByCustomer[customerName].totalAmount += revenue;
            report.salesByCustomer[customerName].totalQuantity += sale.quantity;

            report.sales.push({
                id: sale.id,
                customerName: sale.Customer.name,
                customerMobile: sale.Customer.mobile,
                productName: sale.Stock.Product.name,
                productCategory: sale.Stock.Product.category,
                quantity: sale.quantity,
                sellingPrice: sale.sellingPrice,
                totalAmount: revenue,
                cost: cost,
                profit: profit,
                date: sale.createdAt
            });
        });

        res.status(200).json({
            success: true,
            message: 'Sales report retrieved successfully',
            data: report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sales report',
            error: error.message
        });
    }
};

// Get day-wise sales analytics
exports.getDayWiseSales = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { model: Customer, attributes: ['id', 'name', 'mobile'] },
                { 
                    model: Stock, 
                    attributes: ['id', 'purchasePrice', 'quantity', 'remainingQty'],
                    include: [{ model: Product, attributes: ['id', 'name', 'category'] }]
                }
            ]
        });

        const dayWiseReport = {};

        sales.forEach(sale => {
            // Get date in format YYYY-MM-DD
            const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
            
            const revenue = sale.quantity * sale.sellingPrice;
            const cost = sale.quantity * sale.Stock.purchasePrice;
            const profit = revenue - cost;

            if (!dayWiseReport[saleDate]) {
                dayWiseReport[saleDate] = {
                    date: saleDate,
                    totalSales: 0,
                    totalQuantity: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalProfit: 0,
                    totalLoss: 0,
                    salesData: []
                };
            }

            dayWiseReport[saleDate].totalSales += 1;
            dayWiseReport[saleDate].totalQuantity += sale.quantity;
            dayWiseReport[saleDate].totalRevenue += revenue;
            dayWiseReport[saleDate].totalCost += cost;
            dayWiseReport[saleDate].totalProfit += profit;

            if (profit < 0) {
                dayWiseReport[saleDate].totalLoss += Math.abs(profit);
            }

            dayWiseReport[saleDate].salesData.push({
                id: sale.id,
                customerName: sale.Customer.name,
                customerMobile: sale.Customer.mobile,
                productName: sale.Stock.Product.name,
                quantity: sale.quantity,
                sellingPrice: sale.sellingPrice,
                purchasePrice: sale.Stock.purchasePrice,
                revenue: revenue,
                cost: cost,
                profit: profit,
                time: new Date(sale.createdAt).toLocaleTimeString()
            });
        });

        // Sort by date (newest first)
        const sortedReport = Object.keys(dayWiseReport)
            .sort((a, b) => new Date(b) - new Date(a))
            .reduce((result, key) => {
                result[key] = dayWiseReport[key];
                return result;
            }, {});

        // Summary stats
        let summaryStats = {
            totalDays: Object.keys(sortedReport).length,
            overallRevenue: 0,
            overallProfit: 0,
            overallLoss: 0,
            totalQuantitySold: 0,
            averageRevenuePerDay: 0,
            averageProfitPerDay: 0
        };

        Object.values(sortedReport).forEach(day => {
            summaryStats.overallRevenue += day.totalRevenue;
            summaryStats.overallProfit += day.totalProfit;
            summaryStats.overallLoss += day.totalLoss;
            summaryStats.totalQuantitySold += day.totalQuantity;
        });

        summaryStats.averageRevenuePerDay = summaryStats.totalDays > 0 ? 
            (summaryStats.overallRevenue / summaryStats.totalDays).toFixed(2) : 0;
        summaryStats.averageProfitPerDay = summaryStats.totalDays > 0 ? 
            (summaryStats.overallProfit / summaryStats.totalDays).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            message: 'Day-wise sales analytics retrieved successfully',
            summary: summaryStats,
            data: sortedReport
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching day-wise sales',
            error: error.message
        });
    }
};

// Update payment for a sale
exports.updateSalePayment = async (req, res) => {
    try {
        const { saleId } = req.params;
        const { paymentAmount } = req.body;

        if (!paymentAmount || isNaN(paymentAmount)) {
            return res.status(400).json({
                success: false,
                message: 'Valid payment amount is required'
            });
        }

        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }

        const totalSaleAmount = parseFloat(sale.totalPrice);
        const currentPaid = parseFloat(sale.paidAmount || 0);
        const newPaidAmount = currentPaid + parseFloat(paymentAmount);

        // Validate new paid amount doesn't exceed total
        if (newPaidAmount > totalSaleAmount) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (${newPaidAmount}) exceeds total sale amount (${totalSaleAmount}). Remaining due: ${totalSaleAmount - currentPaid}`
            });
        }

        sale.paidAmount = newPaidAmount;
        await sale.save();

        // Fetch updated sale
        const updatedSale = await Sale.findByPk(saleId, {
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'category', 'price'] }
            ]
        });

        const dueAmount = totalSaleAmount - newPaidAmount;

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully',
            data: {
                ...updatedSale.toJSON(),
                paidAmount: newPaidAmount,
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : 'Partial Payment'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating payment',
            error: error.message
        });
    }
};
