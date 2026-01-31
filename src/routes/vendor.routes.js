const express = require('express');
const router = express.Router();
const vendorController = require('../controller/vendor.controller');

// ==================== VENDOR ROUTES ====================
// Add new vendor
router.post('/add', vendorController.addVendor);

// Get all vendors
router.get('/all', vendorController.getAllVendors);

// Get vendor by ID (with all purchases)
router.get('/:id', vendorController.getVendorById);

// Update vendor
router.put('/update/:id', vendorController.updateVendor);

// Delete vendor
router.delete('/delete/:id', vendorController.deleteVendor);

// ==================== PURCHASE ROUTES ====================
// Create new purchase
router.post('/purchase/create', vendorController.createPurchase);

// Get all purchases
router.get('/purchase/all', vendorController.getAllPurchases);

// Get purchase by ID
router.get('/purchase/:id', vendorController.getPurchaseById);

// Get purchases by vendor
router.get('/purchases/vendor/:vendorId', vendorController.getPurchasesByVendor);

// Update purchase payment
router.put('/purchase/payment/:id', vendorController.updatePurchasePayment);

// Get vendor purchase summary
router.get('/summary/:vendorId', vendorController.getVendorPurchaseSummary);

// Get vendor payment ledger
router.get('/ledger/:vendorId', vendorController.getVendorLedger);

module.exports = router;
