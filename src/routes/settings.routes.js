const express = require('express');
const router = express.Router();
const settingsController = require('../controller/settings.controller');

// Get all settings (optional ?category=bill filter)
router.get('/', settingsController.getAllSettings);

// Get bill settings specifically
router.get('/bill', settingsController.getBillSettings);

// Save bill settings
router.post('/bill', settingsController.saveBillSettings);

// Get single setting by key
router.get('/:key', settingsController.getSetting);

// Update or create a setting
router.post('/', settingsController.upsertSetting);

// Bulk update settings
router.post('/bulk', settingsController.bulkUpdateSettings);

// Delete a setting
router.delete('/:key', settingsController.deleteSetting);

module.exports = router;
