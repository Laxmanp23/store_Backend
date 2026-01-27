const express = require('express');
const router = express.Router();
const stockController = require('../controller/stock.controller');

// Add new stock
router.post('/add', stockController.addStock);

// Get all stock (Dashboard)
router.get('/all', stockController.getAllStock);

// Get stock summary (Dashboard)
router.get('/summary', stockController.getStockSummary);

// Get stock by product ID
router.get('/product/:productId', stockController.getStockByProduct);

// Update stock (Edit prices or quantity)
router.put('/:id', stockController.updateStock);

// Decrease stock quantity (when sale happens)
router.put('/:id/decrease', stockController.decreaseStockQuantity);

// Delete stock
router.delete('/:id', stockController.deleteStock);

module.exports = router;
