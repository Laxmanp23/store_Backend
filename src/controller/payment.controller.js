const { Sale, Customer, Payment, Product } = require('../model');
const { Op } = require('sequelize');

// Record a payment
exports.recordPayment = async (req, res) => {
    try {
        const { saleId, customerId, amountPaid, paymentMethod, notes, transactionId } = req.body;

        if (!saleId || !customerId || !amountPaid || amountPaid <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Sale ID, Customer ID, and valid payment amount are required'
            });
        }

        // Check if sale exists
        const sale = await Sale.findByPk(saleId);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
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

        // Calculate total paid for this sale
        const previousPayments = await Payment.findAll({
            where: { SaleId: saleId }
        });

        const totalPreviousPaid = previousPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid), 0);
        const newTotalPaid = totalPreviousPaid + parseFloat(amountPaid);
        const totalSaleAmount = parseFloat(sale.totalPrice);

        // Validate payment doesn't exceed total
        if (newTotalPaid > totalSaleAmount) {
            return res.status(400).json({
                success: false,
                message: `Payment amount exceeds remaining due. Total sale: ${totalSaleAmount}, Already paid: ${totalPreviousPaid}, Remaining: ${totalSaleAmount - totalPreviousPaid}`
            });
        }

        // Create payment record
        const payment = await Payment.create({
            SaleId: saleId,
            CustomerId: customerId,
            amountPaid,
            paymentMethod: paymentMethod || 'Cash',
            notes: notes || null,
            transactionId: transactionId || null
        });

        // Update sale's paidAmount
        sale.paidAmount = newTotalPaid;
        await sale.save();

        // Fetch payment with related data
        const paymentDetails = await Payment.findByPk(payment.id, {
            include: [
                { model: Sale, attributes: ['id', 'totalPrice', 'paidAmount'] },
                { model: Customer, attributes: ['id', 'name', 'phone'] }
            ]
        });

        // Calculate remaining due
        const remainingDue = totalSaleAmount - newTotalPaid;

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                ...paymentDetails.toJSON(),
                totalSaleAmount: totalSaleAmount,
                totalPaidSoFar: newTotalPaid,
                remainingDue: remainingDue,
                paymentStatus: remainingDue === 0 ? 'Fully Paid' : 'Partial Payment'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error recording payment',
            error: error.message
        });
    }
};

// Get payment history for a sale
exports.getPaymentHistoryForSale = async (req, res) => {
    try {
        const { saleId } = req.params;

        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name', 'price'] }
            ]
        });

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }

        const payments = await Payment.findAll({
            where: { SaleId: saleId },
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] }
            ],
            order: [['createdAt', 'ASC']]
        });

        const totalSaleAmount = parseFloat(sale.totalPrice);
        const totalPaid = parseFloat(sale.paidAmount || 0);
        const remainingDue = totalSaleAmount - totalPaid;

        res.status(200).json({
            success: true,
            message: 'Payment history retrieved successfully',
            saleDetails: {
                saleId: sale.id,
                customer: sale.Customer,
                product: sale.Product,
                quantity: sale.quantity,
                sellingPrice: sale.sellingPrice,
                totalSaleAmount: totalSaleAmount,
                createdAt: sale.createdAt
            },
            paymentHistory: payments,
            paymentSummary: {
                totalPaid: totalPaid,
                remainingDue: remainingDue,
                paymentStatus: remainingDue === 0 ? 'Fully Paid' : (totalPaid > 0 ? 'Partial Payment' : 'Unpaid'),
                totalPayments: payments.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payment history',
            error: error.message
        });
    }
};

// Get all payments for a customer
exports.getCustomerPaymentHistory = async (req, res) => {
    try {
        const { customerId } = req.params;

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const payments = await Payment.findAll({
            where: { CustomerId: customerId },
            include: [
                {
                    model: Sale,
                    attributes: ['id', 'quantity', 'sellingPrice', 'totalPrice', 'paidAmount'],
                    include: [
                        { model: Product, attributes: ['id', 'name'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Calculate summary
        let totalPaid = 0;
        let totalDue = 0;

        payments.forEach(payment => {
            totalPaid += parseFloat(payment.amountPaid);
        });

        // Get all sales for this customer to calculate dues
        const allSales = await Sale.findAll({
            where: { CustomerId: customerId }
        });

        let totalAmount = 0;
        allSales.forEach(sale => {
            totalAmount += parseFloat(sale.totalPrice);
            totalDue += parseFloat(sale.totalPrice) - parseFloat(sale.paidAmount || 0);
        });

        res.status(200).json({
            success: true,
            message: 'Customer payment history retrieved successfully',
            customerName: customer.name,
            paymentHistory: payments,
            summary: {
                totalAmount: totalAmount,
                totalPaid: totalPaid,
                totalDue: totalDue,
                totalPayments: payments.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer payment history',
            error: error.message
        });
    }
};

// Get customer outstanding balance (dues)
exports.getCustomerDues = async (req, res) => {
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
                { model: Product, attributes: ['id', 'name'] }
            ]
        });

        let dueReport = {
            customerName: customer.name,
            customerPhone: customer.phone,
            totalAmount: 0,
            totalPaid: 0,
            outstandingBalance: 0,
            invoices: []
        };

        sales.forEach(sale => {
            const totalSaleAmount = parseFloat(sale.totalPrice);
            const paidAmount = parseFloat(sale.paidAmount || 0);
            const dueAmount = totalSaleAmount - paidAmount;

            dueReport.totalAmount += totalSaleAmount;
            dueReport.totalPaid += paidAmount;
            dueReport.outstandingBalance += dueAmount;

            dueReport.invoices.push({
                id: sale.id,
                productName: sale.Product.name,
                quantity: sale.quantity,
                sellingPrice: sale.sellingPrice,
                totalSaleAmount: totalSaleAmount,
                paidAmount: paidAmount,
                dueAmount: dueAmount,
                paymentStatus: dueAmount === 0 ? 'Fully Paid' : (paidAmount > 0 ? 'Partial Payment' : 'Unpaid'),
                date: sale.createdAt
            });
        });

        // Sort by date
        dueReport.invoices.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            message: 'Customer dues retrieved successfully',
            data: dueReport
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer dues',
            error: error.message
        });
    }
};

// Get all payments
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [
                {
                    model: Sale,
                    attributes: ['id', 'totalPrice', 'paidAmount'],
                    include: [{ model: Product, attributes: ['id', 'name'] }]
                },
                { model: Customer, attributes: ['id', 'name', 'phone'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalPayments = 0;
        payments.forEach(payment => {
            totalPayments += parseFloat(payment.amountPaid);
        });

        res.status(200).json({
            success: true,
            message: 'All payments retrieved successfully',
            totalPayments: totalPayments,
            paymentCount: payments.length,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payments',
            error: error.message
        });
    }
};

// Get payments by date range
exports.getPaymentsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const payments = await Payment.findAll({
            where: {
                createdAt: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            },
            include: [
                {
                    model: Sale,
                    attributes: ['id', 'totalPrice'],
                    include: [{ model: Product, attributes: ['id', 'name'] }]
                },
                { model: Customer, attributes: ['id', 'name', 'phone'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        let totalPayments = 0;
        payments.forEach(payment => {
            totalPayments += parseFloat(payment.amountPaid);
        });

        res.status(200).json({
            success: true,
            message: 'Payments retrieved successfully',
            totalPayments: totalPayments,
            paymentCount: payments.length,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payments',
            error: error.message
        });
    }
};

// Get pending payments (unpaid and partial)
exports.getPendingPayments = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { model: Customer, attributes: ['id', 'name', 'phone'] },
                { model: Product, attributes: ['id', 'name'] },
                { model: Payment, attributes: ['id', 'amountPaid', 'paymentMethod', 'createdAt'] }
            ]
        });

        const pendingPayments = sales
            .map(sale => {
                const totalPaid = parseFloat(sale.paidAmount || 0);
                const totalSaleAmount = parseFloat(sale.totalPrice);
                const remainingDue = totalSaleAmount - totalPaid;

                return {
                    saleId: sale.id,
                    customer: sale.Customer,
                    product: sale.Product,
                    totalSaleAmount: totalSaleAmount,
                    totalPaid: totalPaid,
                    remainingDue: remainingDue,
                    paymentStatus: remainingDue === 0 ? 'Fully Paid' : (totalPaid > 0 ? 'Partial Payment' : 'Unpaid'),
                    lastPaymentDate: sale.Payments && sale.Payments.length > 0 ? sale.Payments[sale.Payments.length - 1].createdAt : null,
                    saleDate: sale.createdAt
                };
            })
            .filter(item => item.remainingDue > 0)
            .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

        let totalPendingAmount = 0;
        pendingPayments.forEach(item => {
            totalPendingAmount += item.remainingDue;
        });

        res.status(200).json({
            success: true,
            message: 'Pending payments retrieved successfully',
            totalPendingAmount: totalPendingAmount,
            pendingCount: pendingPayments.length,
            data: pendingPayments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching pending payments',
            error: error.message
        });
    }
};

// Get all customers dues
exports.getAllCustomersDues = async (req, res) => {
    try {
        const customers = await Customer.findAll({
            include: [{
                model: Sale,
                attributes: ['id', 'quantity', 'sellingPrice', 'totalPrice', 'paidAmount', 'createdAt']
            }]
        });

        let allCustomersDues = [];

        customers.forEach(customer => {
            let totalAmount = 0;
            let totalPaid = 0;
            let outstandingBalance = 0;

            customer.Sales.forEach(sale => {
                const saleAmount = parseFloat(sale.totalPrice) || (sale.quantity * sale.sellingPrice);
                const paid = parseFloat(sale.paidAmount) || 0;
                totalAmount += saleAmount;
                totalPaid += paid;
                outstandingBalance += (saleAmount - paid);
            });

            if (totalAmount > 0) {
                allCustomersDues.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    totalAmount: totalAmount,
                    totalPaid: totalPaid,
                    outstandingBalance: outstandingBalance,
                    totalSales: customer.Sales.length,
                    paymentPercentage: ((totalPaid / totalAmount) * 100).toFixed(2) + '%'
                });
            }
        });

        // Sort by outstanding balance (highest first)
        allCustomersDues.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

        res.status(200).json({
            success: true,
            message: 'All customers dues retrieved successfully',
            totalCustomersWithDues: allCustomersDues.length,
            data: allCustomersDues
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customers dues',
            error: error.message
        });
    }
};
