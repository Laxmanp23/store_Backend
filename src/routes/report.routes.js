const express = require('express');
const router = express.Router();
const reportController = require('../controller/report.controller');

// Dashboard summary (Today, Week, Month overview)
router.get('/dashboard', reportController.getDashboardSummary);

// Sales report (with period filter)
router.get('/sales', reportController.getSalesReport);

// Payment collection report
router.get('/payments', reportController.getPaymentReport);

// Stock report (current inventory status)
router.get('/stock', reportController.getStockReport);

// Profit & Loss report
router.get('/profit-loss', reportController.getProfitLossReport);

// Customer report
router.get('/customers', reportController.getCustomerReport);

module.exports = router;
