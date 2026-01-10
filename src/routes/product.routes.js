const express = require('express');
const router = express.Router();
const productController = require('../controller/product.controller');

// Add new product
router.post('/add', productController.addProduct);

// Get all products
router.get('/all', productController.getAllProducts);

// Delete product (must be before GET /:id)
router.delete('/:id', productController.deleteProduct);

// Get product by ID
router.get('/:id', productController.getProductById);

module.exports = router;
