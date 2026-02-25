const { Sale, SaleItem, Payment, Stock, Product, Customer, Category, sequelize } = require('../model');
const { Op } = require('sequelize');

// Helper function to get date ranges
const getDateRange = (period, customStart, customEnd) => {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
            endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
            break;
        case 'week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
        case 'quarter':
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'custom':
            startDate = new Date(customStart);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEnd);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    return { startDate, endDate };
};

// ==================== SALES REPORT ====================
exports.getSalesReport = async (req, res) => {
    try {
        const { period = 'today', startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(period, customStart, customEnd);

        // Get sales in date range
        const sales = await Sale.findAll({
            where: {
                invoiceDate: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                { model: Customer, attributes: ['id', 'name', 'mobile'] },
                { model: Payment, attributes: ['id', 'amount'] },
                {
                    model: SaleItem,
                    include: [{ model: Product, attributes: ['id', 'name', 'costPrice'] }]
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Calculate metrics from actual Payment records
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
        const totalPaid = sales.reduce((sum, sale) => {
            return sum + (sale.Payments || []).reduce((pSum, p) => pSum + parseFloat(p.amount), 0);
        }, 0);
        const totalPending = totalRevenue - totalPaid;

        // Calculate profit (Revenue - Cost)
        let totalCost = 0;
        sales.forEach(sale => {
            sale.SaleItems.forEach(item => {
                totalCost += parseFloat(item.Product?.costPrice || 0) * item.quantity;
            });
        });
        const totalProfit = totalRevenue - totalCost;

        // Payment status breakdown - calculated from actual payments
        const paymentBreakdown = {
            completed: sales.filter(s => {
                const paid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                return paid >= parseFloat(s.totalAmount);
            }).length,
            partial: sales.filter(s => {
                const paid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                return paid > 0 && paid < parseFloat(s.totalAmount);
            }).length,
            pending: sales.filter(s => {
                const paid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                return paid === 0;
            }).length
        };

        // Daily breakdown (for charts)
        const dailyBreakdown = {};
        sales.forEach(sale => {
            const dateKey = new Date(sale.invoiceDate).toISOString().split('T')[0];
            if (!dailyBreakdown[dateKey]) {
                dailyBreakdown[dateKey] = { sales: 0, revenue: 0, profit: 0 };
            }
            dailyBreakdown[dateKey].sales++;
            dailyBreakdown[dateKey].revenue += parseFloat(sale.totalAmount);
            
            // Calculate cost for this sale
            let saleCost = 0;
            sale.SaleItems.forEach(item => {
                saleCost += parseFloat(item.Product?.costPrice || 0) * item.quantity;
            });
            dailyBreakdown[dateKey].profit += parseFloat(sale.totalAmount) - saleCost;
        });

        res.status(200).json({
            success: true,
            message: 'Sales report generated successfully',
            data: {
                period,
                dateRange: { startDate, endDate },
                summary: {
                    totalSales,
                    totalRevenue: totalRevenue.toFixed(2),
                    totalPaid: totalPaid.toFixed(2),
                    totalPending: totalPending.toFixed(2),
                    totalCost: totalCost.toFixed(2),
                    totalProfit: totalProfit.toFixed(2),
                    profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00',
                    avgSaleValue: totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0.00'
                },
                paymentBreakdown,
                dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({
                    date,
                    ...data,
                    revenue: data.revenue.toFixed(2),
                    profit: data.profit.toFixed(2)
                })).sort((a, b) => a.date.localeCompare(b.date)),
                sales: sales.map(s => {
                    const actualPaid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                    const status = actualPaid >= parseFloat(s.totalAmount) ? 'COMPLETED' : (actualPaid > 0 ? 'PARTIAL' : 'PENDING');
                    return {
                        id: s.id,
                        invoiceNumber: s.invoiceNumber,
                        customer: s.Customer?.name || 'N/A',
                        date: s.invoiceDate,
                        amount: s.totalAmount,
                        paid: actualPaid,
                        status: status
                    };
                })
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating sales report',
            error: error.message
        });
    }
};

// ==================== PAYMENT COLLECTION REPORT ====================
exports.getPaymentReport = async (req, res) => {
    try {
        const { period = 'today', startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(period, customStart, customEnd);

        const payments = await Payment.findAll({
            where: {
                paymentDate: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Sale,
                    include: [{ model: Customer, attributes: ['id', 'name', 'mobile'] }]
                }
            ],
            order: [['paymentDate', 'DESC']]
        });

        // Group by payment mode
        const paymentModeBreakdown = {};
        payments.forEach(payment => {
            const mode = payment.paymentMode || 'CASH';
            if (!paymentModeBreakdown[mode]) {
                paymentModeBreakdown[mode] = { count: 0, amount: 0 };
            }
            paymentModeBreakdown[mode].count++;
            paymentModeBreakdown[mode].amount += parseFloat(payment.amount);
        });

        // Daily collection
        const dailyCollection = {};
        payments.forEach(payment => {
            const dateKey = new Date(payment.paymentDate).toISOString().split('T')[0];
            if (!dailyCollection[dateKey]) {
                dailyCollection[dateKey] = { count: 0, amount: 0 };
            }
            dailyCollection[dateKey].count++;
            dailyCollection[dateKey].amount += parseFloat(payment.amount);
        });

        const totalCollection = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        res.status(200).json({
            success: true,
            message: 'Payment report generated successfully',
            data: {
                period,
                dateRange: { startDate, endDate },
                summary: {
                    totalPayments: payments.length,
                    totalCollection: totalCollection.toFixed(2),
                    avgPayment: payments.length > 0 ? (totalCollection / payments.length).toFixed(2) : '0.00'
                },
                paymentModeBreakdown: Object.entries(paymentModeBreakdown).map(([mode, data]) => ({
                    mode,
                    count: data.count,
                    amount: data.amount.toFixed(2),
                    percentage: ((data.amount / totalCollection) * 100).toFixed(2)
                })),
                dailyCollection: Object.entries(dailyCollection).map(([date, data]) => ({
                    date,
                    count: data.count,
                    amount: data.amount.toFixed(2)
                })).sort((a, b) => a.date.localeCompare(b.date)),
                payments: payments.map(p => ({
                    id: p.id,
                    amount: p.amount,
                    mode: p.paymentMode,
                    date: p.paymentDate,
                    customer: p.Sale?.Customer?.name || 'N/A',
                    invoiceNumber: p.Sale?.invoiceNumber || 'N/A',
                    remark: p.remark
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating payment report',
            error: error.message
        });
    }
};

// ==================== STOCK REPORT ====================
exports.getStockReport = async (req, res) => {
    try {
        const stocks = await Stock.findAll({
            include: [
                {
                    model: Product,
                    attributes: ['id', 'name', 'CategoryId', 'costPrice'],
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                }
            ],
            order: [['quantity', 'ASC']]
        });

        // Calculate totals
        let totalCostValue = 0;
        let totalSaleValue = 0;
        let totalQuantity = 0;
        let lowStockItems = [];
        let outOfStockItems = [];

        const categoryBreakdown = {};

        stocks.forEach(stock => {
            const qty = parseFloat(stock.quantity) || 0;
            const costValue = parseFloat(stock.purchasePrice) * qty;
            const saleValue = parseFloat(stock.salePrice) * qty;
            
            totalCostValue += costValue;
            totalSaleValue += saleValue;
            totalQuantity += qty;

            // Low stock (below 10)
            if (qty > 0 && qty <= 10) {
                lowStockItems.push({
                    id: stock.id,
                    productName: stock.Product?.name,
                    quantity: qty,
                    purchasePrice: stock.purchasePrice,
                    salePrice: stock.salePrice
                });
            }

            // Out of stock
            if (qty === 0) {
                outOfStockItems.push({
                    id: stock.id,
                    productName: stock.Product?.name,
                    originalQuantity: parseFloat(stock.originalQuantity) || 0
                });
            }

            // Category breakdown
            const categoryName = stock.Product?.Category?.name || 'Uncategorized';
            if (!categoryBreakdown[categoryName]) {
                categoryBreakdown[categoryName] = { items: 0, quantity: 0, value: 0 };
            }
            categoryBreakdown[categoryName].items++;
            categoryBreakdown[categoryName].quantity += qty;
            categoryBreakdown[categoryName].value += costValue;
        });

        res.status(200).json({
            success: true,
            message: 'Stock report generated successfully',
            data: {
                summary: {
                    totalBatches: stocks.length,
                    totalQuantity,
                    totalCostValue: totalCostValue.toFixed(2),
                    totalSaleValue: totalSaleValue.toFixed(2),
                    potentialProfit: (totalSaleValue - totalCostValue).toFixed(2),
                    lowStockCount: lowStockItems.length,
                    outOfStockCount: outOfStockItems.length
                },
                categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]) => ({
                    category,
                    items: data.items,
                    quantity: data.quantity,
                    value: data.value.toFixed(2)
                })),
                lowStockItems,
                outOfStockItems,
                allStock: stocks.map(s => {
                    const qty = parseFloat(s.quantity) || 0;
                    return {
                        id: s.id,
                        productName: s.Product?.name,
                        category: s.Product?.Category?.name || 'N/A',
                        quantity: qty,
                        originalQuantity: parseFloat(s.originalQuantity) || 0,
                        purchasePrice: s.purchasePrice,
                        salePrice: s.salePrice,
                        costValue: (parseFloat(s.purchasePrice) * qty).toFixed(2),
                        saleValue: (parseFloat(s.salePrice) * qty).toFixed(2)
                    };
                })
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating stock report',
            error: error.message
        });
    }
};

// ==================== PROFIT & LOSS REPORT ====================
exports.getProfitLossReport = async (req, res) => {
    try {
        const { period = 'month', startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(period, customStart, customEnd);

        // Get all sales with items for cost calculation
        const sales = await Sale.findAll({
            where: {
                invoiceDate: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: SaleItem,
                    include: [{ model: Product, attributes: ['id', 'name', 'costPrice'] }]
                }
            ]
        });

        // Calculate revenue and cost
        let totalRevenue = 0;
        let totalCost = 0;
        const productProfits = {};

        sales.forEach(sale => {
            totalRevenue += parseFloat(sale.totalAmount);
            
            sale.SaleItems.forEach(item => {
                const cost = parseFloat(item.Product?.costPrice || 0) * item.quantity;
                const revenue = parseFloat(item.unitPrice) * item.quantity;
                totalCost += cost;

                const productName = item.Product?.name || 'Unknown';
                if (!productProfits[productName]) {
                    productProfits[productName] = { revenue: 0, cost: 0, quantity: 0 };
                }
                productProfits[productName].revenue += revenue;
                productProfits[productName].cost += cost;
                productProfits[productName].quantity += item.quantity;
            });
        });

        const grossProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Top profitable products
        const topProducts = Object.entries(productProfits)
            .map(([name, data]) => ({
                name,
                revenue: data.revenue.toFixed(2),
                cost: data.cost.toFixed(2),
                profit: (data.revenue - data.cost).toFixed(2),
                quantity: data.quantity,
                margin: data.revenue > 0 ? (((data.revenue - data.cost) / data.revenue) * 100).toFixed(2) : '0.00'
            }))
            .sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))
            .slice(0, 10);

        res.status(200).json({
            success: true,
            message: 'Profit & Loss report generated successfully',
            data: {
                period,
                dateRange: { startDate, endDate },
                summary: {
                    totalRevenue: totalRevenue.toFixed(2),
                    totalCost: totalCost.toFixed(2),
                    grossProfit: grossProfit.toFixed(2),
                    profitMargin: profitMargin.toFixed(2),
                    totalSales: sales.length
                },
                topProducts
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating profit & loss report',
            error: error.message
        });
    }
};

// ==================== CUSTOMER REPORT ====================
exports.getCustomerReport = async (req, res) => {
    try {
        const { period = 'month', startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(period, customStart, customEnd);

        const customers = await Customer.findAll({
            include: [
                {
                    model: Sale,
                    where: {
                        invoiceDate: {
                            [Op.between]: [startDate, endDate]
                        }
                    },
                    required: false
                }
            ]
        });

        const customerStats = customers.map(customer => {
            const sales = customer.Sales || [];
            const totalPurchases = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
            const totalPaid = sales.reduce((sum, s) => sum + parseFloat(s.totalPaid), 0);
            const outstanding = totalPurchases - totalPaid;

            return {
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile,
                salesCount: sales.length,
                totalPurchases: totalPurchases.toFixed(2),
                totalPaid: totalPaid.toFixed(2),
                outstanding: outstanding.toFixed(2)
            };
        }).filter(c => c.salesCount > 0).sort((a, b) => parseFloat(b.totalPurchases) - parseFloat(a.totalPurchases));

        // Top customers
        const topCustomers = customerStats.slice(0, 10);

        // Customers with outstanding
        const customersWithDues = customerStats.filter(c => parseFloat(c.outstanding) > 0);

        res.status(200).json({
            success: true,
            message: 'Customer report generated successfully',
            data: {
                period,
                dateRange: { startDate, endDate },
                summary: {
                    totalCustomers: customerStats.length,
                    totalRevenue: customerStats.reduce((sum, c) => sum + parseFloat(c.totalPurchases), 0).toFixed(2),
                    totalOutstanding: customerStats.reduce((sum, c) => sum + parseFloat(c.outstanding), 0).toFixed(2)
                },
                topCustomers,
                customersWithDues
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating customer report',
            error: error.message
        });
    }
};

// ==================== DASHBOARD SUMMARY ====================
exports.getDashboardSummary = async (req, res) => {
    try {
        const today = new Date();
        const { startDate: todayStart, endDate: todayEnd } = getDateRange('today');
        const { startDate: weekStart } = getDateRange('week');
        const { startDate: monthStart } = getDateRange('month');

        // Today's sales
        const todaySales = await Sale.findAll({
            where: {
                invoiceDate: { [Op.between]: [todayStart, todayEnd] }
            }
        });

        // This week's sales
        const weekSales = await Sale.findAll({
            where: {
                invoiceDate: { [Op.between]: [weekStart, todayEnd] }
            }
        });

        // This month's sales
        const monthSales = await Sale.findAll({
            where: {
                invoiceDate: { [Op.between]: [monthStart, todayEnd] }
            }
        });

        // Today's payments
        const todayPayments = await Payment.findAll({
            where: {
                paymentDate: { [Op.between]: [todayStart, todayEnd] }
            }
        });

        // Stock summary
        const stocks = await Stock.findAll();
        const stockValue = stocks.reduce((sum, s) => sum + (parseFloat(s.purchasePrice) * s.quantity), 0);
        const potentialSaleValue = stocks.reduce((sum, s) => sum + (parseFloat(s.salePrice) * s.quantity), 0);

        // Outstanding payments
        const outstandingSales = await Sale.findAll({
            where: {
                paymentStatus: { [Op.in]: ['PENDING', 'PARTIAL'] }
            }
        });
        const totalOutstanding = outstandingSales.reduce((sum, s) => 
            sum + (parseFloat(s.totalAmount) - parseFloat(s.totalPaid)), 0
        );

        res.status(200).json({
            success: true,
            data: {
                today: {
                    sales: todaySales.length,
                    revenue: todaySales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0).toFixed(2),
                    collections: todayPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)
                },
                week: {
                    sales: weekSales.length,
                    revenue: weekSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0).toFixed(2)
                },
                month: {
                    sales: monthSales.length,
                    revenue: monthSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0).toFixed(2)
                },
                stock: {
                    batches: stocks.length,
                    totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
                    costValue: stockValue.toFixed(2),
                    saleValue: potentialSaleValue.toFixed(2),
                    potentialProfit: (potentialSaleValue - stockValue).toFixed(2)
                },
                outstanding: {
                    count: outstandingSales.length,
                    amount: totalOutstanding.toFixed(2)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating dashboard summary',
            error: error.message
        });
    }
};
