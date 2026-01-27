const express = require('express');
const router = express.Router();
const saleController = require('../controller/sale.controller');

// Create new sale
router.post('/create', saleController.createSale);

// Get all sales
router.get('/all', saleController.getAllSales);

// Get sales summary/dashboard
router.get('/summary', saleController.getSalesSummary);

// Get today's sales
router.get('/today', saleController.getTodaySales);

// Get sales by customer
router.get('/customer/:customerId', saleController.getSalesByCustomer);

// Get sale by ID (must be after specific routes)
router.get('/:id', saleController.getSaleById);

module.exports = router;
