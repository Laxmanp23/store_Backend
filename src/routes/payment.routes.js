const express = require('express');
const router = express.Router();
const paymentController = require('../controller/payment.controller');

// Record payment for a sale
router.post('/record', paymentController.recordPayment);

// Get all payments (Admin view)
router.get('/all', paymentController.getAllPayments);

// Get outstanding/pending payments
router.get('/outstanding', paymentController.getOutstandingPayments);

// Get payments by date range
router.get('/range', paymentController.getPaymentsByDateRange);

// Get payment history for a specific sale
router.get('/sale/:saleId', paymentController.getPaymentHistoryForSale);

// Get customer payment ledger
router.get('/ledger/:customerId', paymentController.getPaymentLedgerForCustomer);

module.exports = router;
