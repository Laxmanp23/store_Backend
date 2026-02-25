const { Sale, Payment, Customer, Product, sequelize } = require('../model');
const { Op } = require('sequelize');

// Record payment
exports.recordPayment = async (req, res) => {
    const transaction = await sequelize.transaction();
    
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
        const sale = await Sale.findByPk(saleId, {
            include: [{ model: Payment, attributes: ['amount'] }]
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
        
        // Check if payment amount exceeds remaining balance
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
        }, { transaction });

        // Update sale totalPaid and paymentStatus
        const newTotalPaid = actualPaid + parseFloat(amount);
        let paymentStatus = 'PENDING';

        if (newTotalPaid >= sale.totalAmount) {
            paymentStatus = 'COMPLETED';
        } else if (newTotalPaid > 0) {
            paymentStatus = 'PARTIAL';
        }

        await sale.update({
            totalPaid: newTotalPaid,
            paymentStatus
        }, { transaction });

        await transaction.commit();

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
        await transaction.rollback();
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
        const { customerId } = req.params;

        // Check if customer exists
        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get all sales for customer
        const sales = await Sale.findAll({
            where: { CustomerId: customerId },
            include: [{
                model: Payment,
                attributes: ['id', 'amount', 'paymentMode', 'paymentDate', 'remark']
            }],
            order: [['invoiceDate', 'ASC']] // Oldest first for proper ledger
        });

        // Build ledger with proper entries
        const ledger = [];
        let runningBalance = 0;

        for (const sale of sales) {
            // Calculate actual paid from payments
            const payments = sale.Payments || [];
            const actualPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const dueAmount = parseFloat(sale.totalAmount) - actualPaid;

            // Add sale entry (Debit - customer owes money)
            runningBalance += parseFloat(sale.totalAmount);
            ledger.push({
                date: sale.invoiceDate,
                referenceId: sale.invoiceNumber,
                saleId: sale.id,
                type: 'SALE',
                description: `Invoice ${sale.invoiceNumber}`,
                debit: parseFloat(sale.totalAmount),
                credit: 0,
                balance: runningBalance,
                totalAmount: parseFloat(sale.totalAmount),
                totalPaid: actualPaid,
                dueAmount: dueAmount
            });

            // Add payment entries (Credit - customer paid)
            for (const payment of payments) {
                runningBalance -= parseFloat(payment.amount);
                ledger.push({
                    date: payment.paymentDate,
                    referenceId: `PAY-${payment.id}`,
                    saleId: sale.id,
                    type: 'PAYMENT',
                    description: `${payment.paymentMode} - ${payment.remark || 'Payment received'}`,
                    remark: payment.remark,
                    debit: 0,
                    credit: parseFloat(payment.amount),
                    balance: runningBalance
                });
            }
        }

        // Sort ledger by date
        ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Recalculate running balance after sort
        let balance = 0;
        ledger.forEach(entry => {
            balance += entry.debit - entry.credit;
            entry.balance = balance;
        });

        // Summary - calculate from actual ledger entries
        const totalSales = ledger.reduce((sum, entry) => sum + entry.debit, 0);
        const totalPaid = ledger.reduce((sum, entry) => sum + entry.credit, 0);
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
            data: ledger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer ledger',
            error: error.message
        });
    }
};

// Get all payments (Admin view) - with pagination
exports.getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 50, mode = '', all = false } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        let whereClause = {};
        if (mode && ['CASH', 'UPI', 'BANK', 'CARD'].includes(mode)) {
            whereClause.paymentMode = mode;
        }

        // If all=true, return all for reports
        if (all === 'true' || all === true) {
            const payments = await Payment.findAll({
                include: [
                    { model: Sale, attributes: ['id', 'invoiceNumber', 'totalAmount'] },
                    { model: Customer, attributes: ['id', 'name', 'mobile'] }
                ],
                order: [['paymentDate', 'DESC']]
            });
            const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            return res.status(200).json({
                success: true,
                message: 'All payments retrieved successfully',
                summary: { totalPayments: payments.length, totalCollected },
                data: payments
            });
        }

        const { count, rows: payments } = await Payment.findAndCountAll({
            where: whereClause,
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
            order: [['paymentDate', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            distinct: true
        });

        const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const totalPages = Math.ceil(count / parseInt(limit));
        const currentPage = parseInt(page);

        res.status(200).json({
            success: true,
            message: 'All payments retrieved successfully',
            summary: {
                totalPayments: count,
                totalCollected
            },
            data: payments,
            pagination: {
                currentPage: currentPage,
                totalPages: totalPages,
                totalItems: count,
                itemsPerPage: parseInt(limit),
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
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
            include: [
                { 
                    model: Customer, 
                    attributes: ['id', 'name', 'mobile'] 
                },
                {
                    model: Payment,
                    attributes: ['id', 'amount']
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Filter and calculate from actual Payment records
        const outstanding = sales
            .map(s => {
                const actualPaid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const outstandingAmount = parseFloat(s.totalAmount) - actualPaid;
                return {
                    saleId: s.id,
                    invoiceNumber: s.invoiceNumber,
                    customerName: s.Customer?.name || 'Unknown',
                    customerMobile: s.Customer?.mobile || '',
                    saleDate: s.invoiceDate,
                    totalAmount: s.totalAmount,
                    paidAmount: actualPaid,
                    outstandingAmount: outstandingAmount,
                    status: outstandingAmount <= 0 ? 'COMPLETED' : (actualPaid > 0 ? 'PARTIAL' : 'PENDING'),
                    daysOverdue: Math.floor((new Date() - new Date(s.invoiceDate)) / (1000 * 60 * 60 * 24))
                };
            })
            .filter(o => o.outstandingAmount > 0);

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
