const { Sale, Payment, Stock, Product, Customer, Category, sequelize } = require('../model');
const { Op } = require('sequelize');

// Get all notifications (low stock, recent payments, outstanding, recent sales)
exports.getNotifications = async (req, res) => {
    try {
        const notifications = [];
        const now = new Date();

        // 1. Low Stock Alerts (quantity < 10)
        const allStocks = await Stock.findAll({
            include: [{
                model: Product,
                attributes: ['id', 'name']
            }]
        });

        // Group by product and check total quantity
        const productStockMap = {};
        allStocks.forEach(stock => {
            const productId = stock.productId || stock.ProductId;
            if (!productId) return;
            if (!productStockMap[productId]) {
                productStockMap[productId] = {
                    product: stock.Product,
                    totalQuantity: 0
                };
            }
            productStockMap[productId].totalQuantity += parseFloat(stock.quantity || 0);
        });

        const minLevel = 10; // Default minimum stock level
        const lowStockProducts = [];
        
        Object.values(productStockMap).forEach(item => {
            if (item.totalQuantity < minLevel && item.product) {
                lowStockProducts.push({
                    name: item.product.name,
                    quantity: item.totalQuantity
                });
            }
        });

        // Add individual low stock notifications (max 5)
        lowStockProducts.slice(0, 5).forEach((product, index) => {
            notifications.push({
                id: `low-stock-${index}-${Date.now()}`,
                type: 'warning',
                title: 'Low Stock',
                message: `${product.name} - Only ${product.quantity} left`,
                time: 'Action needed',
                read: false,
                link: '/stock',
                priority: 1
            });
        });

        // If more than 5, add summary
        if (lowStockProducts.length > 5) {
            notifications.push({
                id: `low-stock-more-${Date.now()}`,
                type: 'warning',
                title: 'Low Stock Alert',
                message: `${lowStockProducts.length - 5} more products running low`,
                time: 'Action needed',
                read: false,
                link: '/stock',
                priority: 1
            });
        }

        // 2. Recent Payments (last 24 hours)
        const recentPayments = await Payment.findAll({
            where: {
                paymentDate: {
                    [Op.gte]: new Date(now.getTime() - 24 * 60 * 60 * 1000)
                }
            },
            include: [
                { model: Customer, attributes: ['id', 'name'] },
                { model: Sale, attributes: ['id', 'invoiceNumber'] }
            ],
            order: [['paymentDate', 'DESC']],
            limit: 5
        });

        recentPayments.forEach(payment => {
            const timeAgo = getTimeAgo(payment.paymentDate);
            notifications.push({
                id: `payment-${payment.id}`,
                type: 'success',
                title: 'Payment Received',
                message: `₹${parseFloat(payment.amount).toFixed(2)} from ${payment.Customer?.name || 'Unknown'}`,
                time: timeAgo,
                read: false,
                link: `/sales/view/${payment.saleId}`,
                priority: 2
            });
        });

        // 3. Outstanding Payments (high priority - invoices older than 30 days with pending amount)
        const outstandingSales = await Sale.findAll({
            include: [
                { model: Customer, attributes: ['id', 'name'] },
                { model: Payment, attributes: ['id', 'amount'] }
            ],
            where: {
                invoiceDate: {
                    [Op.lte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                }
            },
            order: [['invoiceDate', 'ASC']]
        });

        let overdueCount = 0;
        let totalOverdue = 0;

        outstandingSales.forEach(sale => {
            const actualPaid = (sale.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const outstanding = parseFloat(sale.totalAmount) - actualPaid;
            if (outstanding > 0) {
                overdueCount++;
                totalOverdue += outstanding;
            }
        });

        if (overdueCount > 0) {
            notifications.push({
                id: `overdue-${Date.now()}`,
                type: 'error',
                title: 'Overdue Payments',
                message: `${overdueCount} invoice${overdueCount > 1 ? 's' : ''} overdue (₹${totalOverdue.toFixed(2)} pending)`,
                time: 'Action needed',
                read: false,
                link: '/payments',
                priority: 0
            });
        }

        // 4. Recent Sales (today)
        const todaySales = await Sale.findAll({
            where: {
                invoiceDate: {
                    [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
                }
            },
            include: [
                { model: Customer, attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 3
        });

        todaySales.forEach(sale => {
            const timeAgo = getTimeAgo(sale.createdAt);
            notifications.push({
                id: `sale-${sale.id}`,
                type: 'info',
                title: 'New Sale',
                message: `Invoice #${sale.invoiceNumber} - ₹${parseFloat(sale.totalAmount).toFixed(2)}`,
                time: timeAgo,
                read: false,
                link: `/sales/view/${sale.id}`,
                priority: 3
            });
        });

        // Sort by priority (lower = higher priority)
        notifications.sort((a, b) => a.priority - b.priority);

        res.status(200).json({
            success: true,
            message: 'Notifications retrieved successfully',
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// Get notification summary (counts only)
exports.getNotificationSummary = async (req, res) => {
    try {
        const now = new Date();

        // Low stock count
        const stocks = await Stock.findAll({
            include: [{ model: Product, attributes: ['id', 'name'] }]
        });
        
        const productStockMap = {};
        stocks.forEach(stock => {
            const pid = stock.productId || stock.ProductId;
            if (pid && !productStockMap[pid]) {
                productStockMap[pid] = { total: 0 };
            }
            if (pid) {
                productStockMap[pid].total += parseFloat(stock.quantity) || 0;
            }
        });
        
        const minLevel = 10; // Default minimum stock level
        // Include 0-stock items as well
        const lowStockCount = Object.values(productStockMap).filter(p => p.total < minLevel).length;

        // Overdue payments (>30 days)
        const overdueInvoices = await Sale.findAll({
            include: [{ model: Payment, attributes: ['amount'] }],
            where: {
                invoiceDate: { [Op.lte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
            }
        });
        
        const overdueCount = overdueInvoices.filter(s => {
            const paid = (s.Payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
            return (parseFloat(s.totalAmount) - paid) > 0;
        }).length;

        // Today's payments
        const todayPayments = await Payment.count({
            where: {
                paymentDate: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) }
            }
        });

        // Today's sales
        const todaySales = await Sale.count({
            where: {
                invoiceDate: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) }
            }
        });

        const totalUnread = lowStockCount + overdueCount + todayPayments + todaySales;

        res.status(200).json({
            success: true,
            data: {
                lowStock: lowStockCount,
                overdue: overdueCount,
                todayPayments: todayPayments,
                todaySales: todaySales,
                totalUnread: Math.min(totalUnread, 99) // Cap at 99
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notification summary',
            error: error.message
        });
    }
};

// Helper function for time ago
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
}
