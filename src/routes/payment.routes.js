const express = require('express');
const router = express.Router();
const paymentController = require('../controller/payment.controller');

// Record payment for a sale
router.post('/record', paymentController.recordPayment);

// Get payment history for a specific sale
router.get('/sale/:saleId', paymentController.getPaymentHistoryForSale);

// Get all payments for a customer
router.get('/customer/:customerId/history', paymentController.getCustomerPaymentHistory);

// Get customer outstanding dues
router.get('/customer/:customerId/dues', paymentController.getCustomerDues);

// Get all payments
router.get('/all', paymentController.getAllPayments);

// Get payments by date range
router.get('/date-range', paymentController.getPaymentsByDateRange);

// Get pending payments
router.get('/pending', paymentController.getPendingPayments);

// Get all customers with outstanding dues
router.get('/dues/all', paymentController.getAllCustomersDues);

module.exports = router;
