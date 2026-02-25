const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notification.controller');

// Get all notifications
router.get('/all', notificationController.getNotifications);

// Get notification summary (counts)
router.get('/summary', notificationController.getNotificationSummary);

module.exports = router;
