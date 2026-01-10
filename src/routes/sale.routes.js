const express = require('express');
const router = express.Router();
const saleController = require('../controller/sale.controller');

// Create new sale
router.post('/create', saleController.createSale);

// Update payment for a sale
router.post('/:saleId/payment', saleController.updateSalePayment);

// Get all sales
router.get('/all', saleController.getAllSales);

// Get today's sales
router.get('/today', saleController.getTodaySales);

// Get sales report/dashboard
router.get('/report', saleController.getSalesReport);

// Get day-wise sales analytics
router.get('/daywise', saleController.getDayWiseSales);

// Get sales by date range
router.get('/daterange', saleController.getSalesByDateRange);

// Get sales by customer
router.get('/customer/:customerId', saleController.getSalesByCustomer);

module.exports = router;
