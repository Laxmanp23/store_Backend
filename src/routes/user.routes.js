const express = require('express');
const router = express.Router();
const userController = require('../controller/user.controller');

// User signup route
router.post('/signup', userController.signup);

// User login route
router.post('/login', userController.login);
router.put('/updateuser/:id',userController.updateUser);

module.exports = router;
