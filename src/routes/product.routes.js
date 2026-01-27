const express = require('express');
const router = express.Router();
const productController = require('../controller/product.controller');

// Add new product
router.post('/add', productController.addProduct);

// Get all products
router.get('/all', productController.getAllProducts);

// Get product by ID (must be after specific routes)
router.get('/:id', productController.getProductById);

// Update product
router.put('/:id', productController.updateProduct);

// Delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;
