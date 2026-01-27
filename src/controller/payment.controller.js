const { Sale, Payment, Customer, Product } = require('../model');
const { Op } = require('sequelize');

// Record payment
exports.recordPayment = async (req, res) => {
    try {
        const { saleId, amount, paymentMode, remark } = req.body;

        // Validation
        if (!saleId || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Sale ID and valid payment amount are required'
            });
        }

        if (!['CASH', 'UPI', 'BANK', 'CARD'].includes(paymentMode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment mode. Must be CASH, UPI, BANK, or CARD'
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

        // Check if payment amount exceeds remaining balance
        const remainingBalance = sale.totalAmount - sale.totalPaid;
        if (amount > remainingBalance) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (${amount}) exceeds remaining balance (${remainingBalance})`
            });
        }

        // Create payment record
        const payment = await Payment.create({
            saleId,
            CustomerId: sale.CustomerId,
            amount: parseFloat(amount),
            paymentMode,
            remark: remark || null
        });

        // Update sale totalPaid and paymentStatus
        const newTotalPaid = parseFloat(sale.totalPaid) + parseFloat(amount);
        let paymentStatus = 'PENDING';

        if (newTotalPaid >= sale.totalAmount) {
            paymentStatus = 'COMPLETED';
        } else if (newTotalPaid > 0) {
            paymentStatus = 'PARTIAL';
        }

        await sale.update({
            totalPaid: newTotalPaid,
            paymentStatus
        });

        // Fetch payment with details
        const paymentDetails = await Payment.findByPk(payment.id, {
            include: [
                { 
                    model: Sale, 
                    attributes: ['id', 'invoiceNumber', 'totalAmount'] 
                },
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile'] 
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                ...paymentDetails.toJSON(),
                saleDetails: {
                    totalAmount: sale.totalAmount,
                    totalPaid: newTotalPaid,
                    remainingBalance: sale.totalAmount - newTotalPaid,
                    paymentStatus
                }
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

        // Check if sale exists
        const sale = await Sale.findByPk(saleId);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Sale not found'
            });
        }

        const payments = await Payment.findAll({
            where: { saleId },
            order: [['paymentDate', 'DESC']]
        });

        const paymentHistory = payments.map(p => ({
            id: p.id,
            date: p.paymentDate,
            amount: p.amount,
            mode: p.paymentMode,
            remark: p.remark
        }));

        res.status(200).json({
            success: true,
            message: 'Payment history retrieved successfully',
            saleDetails: {
                id: sale.id,
                invoiceNumber: sale.invoiceNumber,
                totalAmount: sale.totalAmount,
                totalPaid: sale.totalPaid,
                remainingBalance: sale.totalAmount - sale.totalPaid,
                paymentStatus: sale.paymentStatus
            },
            payments: paymentHistory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching payment history',
            error: error.message
        });
    }
};

// Get payment history for a customer (Payment Ledger)
exports.getPaymentLedgerForCustomer = async (req, res) => {
    try {
        const { CustomerId } = req.params;

        // Check if customer exists
        const customer = await Customer.findByPk(CustomerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get all sales for customer
        const sales = await Sale.findAll({
            where: { CustomerId },
            order: [['invoiceDate', 'DESC']]
        });

        // Build ledger
        const ledger = [];
        let runningBalance = 0;

        for (const sale of sales) {
            const payments = await Payment.findAll({
                where: { saleId: sale.id },
                order: [['paymentDate', 'DESC']]
            });

            ledger.push({
                invoiceNumber: sale.invoiceNumber,
                date: sale.invoiceDate,
                debit: sale.totalAmount,
                credit: sale.totalPaid,
                balance: sale.totalAmount - sale.totalPaid,
                status: sale.paymentStatus,
                payments: payments.map(p => ({
                    paymentDate: p.paymentDate,
                    amount: p.amount,
                    mode: p.paymentMode
                }))
            });

            runningBalance += (sale.totalAmount - sale.totalPaid);
        }

        // Summary
        const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
        const totalPaid = sales.reduce((sum, s) => sum + parseFloat(s.totalPaid), 0);
        const totalOutstanding = totalSales - totalPaid;

        res.status(200).json({
            success: true,
            message: 'Customer payment ledger retrieved successfully',
            customer: {
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile,
                address: customer.address
            },
            summary: {
                totalSales,
                totalPaid,
                totalOutstanding,
                invoiceCount: sales.length
            },
            ledger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer ledger',
            error: error.message
        });
    }
};

// Get all payments (Admin view)
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [
                { 
                    model: Sale, 
                    attributes: ['id', 'invoiceNumber', 'totalAmount'] 
                },
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile'] 
                }
            ],
            order: [['paymentDate', 'DESC']]
        });

        const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        res.status(200).json({
            success: true,
            message: 'All payments retrieved successfully',
            summary: {
                totalPayments: payments.length,
                totalCollected
            },
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
                paymentDate: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            },
            include: [
                { 
                    model: Sale, 
                    attributes: ['id', 'invoiceNumber'] 
                },
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile'] 
                }
            ],
            order: [['paymentDate', 'DESC']]
        });

        const byMode = {
            CASH: 0,
            UPI: 0,
            BANK: 0,
            CARD: 0
        };

        payments.forEach(p => {
            byMode[p.paymentMode] += parseFloat(p.amount);
        });

        const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        res.status(200).json({
            success: true,
            message: 'Payments retrieved successfully',
            summary: {
                totalPayments: payments.length,
                totalCollected,
                byPaymentMode: byMode
            },
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

// Get outstanding payments (Pending ledger)
exports.getOutstandingPayments = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            where: {
                paymentStatus: {
                    [Op.ne]: 'COMPLETED'
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

        const outstanding = sales.map(s => ({
            invoiceNumber: s.invoiceNumber,
            customerName: s.Customer.name,
            customerMobile: s.Customer.mobile,
            saleDate: s.invoiceDate,
            totalAmount: s.totalAmount,
            paidAmount: s.totalPaid,
            outstandingAmount: s.totalAmount - s.totalPaid,
            status: s.paymentStatus,
            daysOverdue: Math.floor((new Date() - new Date(s.invoiceDate)) / (1000 * 60 * 60 * 24))
        }));

        const totalOutstanding = outstanding.reduce((sum, o) => sum + parseFloat(o.outstandingAmount), 0);

        res.status(200).json({
            success: true,
            message: 'Outstanding payments retrieved successfully',
            summary: {
                totalOutstandingAmount: totalOutstanding,
                invoiceCount: outstanding.length
            },
            data: outstanding
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching outstanding payments',
            error: error.message
        });
    }
};
