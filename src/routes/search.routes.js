const express = require('express');
const router = express.Router();
const searchController = require('../controller/search.controller');

// Global search - searches across all entities
// GET /api/search?q=term&type=products&limit=10
router.get('/', searchController.globalSearch);

// Quick search for autocomplete
// GET /api/search/quick?q=term&limit=8
router.get('/quick', searchController.quickSearch);

// Advanced search with filters
// GET /api/search/advanced?q=term&type=products&category=1&priceMin=100&priceMax=1000
router.get('/advanced', searchController.advancedSearch);

module.exports = router;
