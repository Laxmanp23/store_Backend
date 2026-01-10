const express = require('express');
const router = express.Router();
const customerController = require('../controller/customer.controller');

// Add new customer
router.post('/add', customerController.addCustomer);

// Get all customers
router.get('/all', customerController.getAllCustomers);

// Get customer by ID
router.get('/:id', customerController.getCustomerById);

// Update customer
router.put('/update/:id', customerController.updateCustomer);

module.exports = router;
