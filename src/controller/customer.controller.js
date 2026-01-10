const { Customer } = require('../model');

// Add new customer
exports.addCustomer = async (req, res) => {
    try {
        const { name, mobile, phone, address } = req.body;

        // Accept either mobile or phone
        const phoneNumber = mobile || phone;

        // Validation
        if (!name || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Customer name and phone number are required'
            });
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ 
            where: { 
                mobile: phoneNumber 
            } 
        });
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Customer with this phone number already exists'
            });
        }

        // Create customer
        const customer = await Customer.create({
            name,
            mobile: phoneNumber,
            phone: phoneNumber,
            address: address || ''
        });

        res.status(201).json({
            success: true,
            message: 'Customer added successfully',
            data: customer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding customer',
            error: error.message
        });
    }
};

// Get all customers
exports.getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.findAll();

        res.status(200).json({
            success: true,
            message: 'Customers retrieved successfully',
            data: customers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customers',
            error: error.message
        });
    }
};

// Get customer by ID
exports.getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Customer retrieved successfully',
            data: customer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching customer',
            error: error.message
        });
    }
};

// Update customer
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile } = req.body;

        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        if (name) customer.name = name;
        if (mobile) customer.mobile = mobile;

        await customer.save();

        res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            data: customer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating customer',
            error: error.message
        });
    }
};
