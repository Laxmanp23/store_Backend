const express = require('express');
const router = express.Router();
const productController = require('../controller/product.controller');

// Add new product
router.post('/add', productController.addProduct);

// Get all products
router.get('/all', productController.getAllProducts);

// ==================== VENDOR MANAGEMENT ROUTES ====================

// Add vendor to product
router.post('/:productId/vendors', productController.addVendorToProduct);

// Get product vendors
router.get('/:productId/vendors', productController.getProductVendors);

// Update vendor for product
router.put('/:productId/vendors/:vendorId', productController.updateProductVendor);

// Remove vendor from product
router.delete('/:productId/vendors/:vendorId', productController.removeVendorFromProduct);

// Get product by ID (must be after specific routes)
router.get('/:id', productController.getProductById);

// Update product
router.put('/:id', productController.updateProduct);

// Delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;
