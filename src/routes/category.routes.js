const express = require('express');
const router = express.Router();
const categoryController = require('../controller/category.controller');
const authMiddleware = require('../middleware/authmiddleware');

// All routes require authentication
router.use(authMiddleware);

// Category CRUD operations
router.post('/add', categoryController.addCategory);
router.get('/all', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
