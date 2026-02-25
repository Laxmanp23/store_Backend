const { Customer } = require('../model');

// Add new customer
exports.addCustomer = async (req, res) => {
    try {
        const { name, mobile,  address } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Customer name and phone number are required'
            });
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ 
            where: { 
                mobile: mobile
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
            mobile,
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

// Get all customers with pagination
exports.getAllCustomers = async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', all = false } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // If all=true, return all customers (for dropdowns)
        if (all === 'true' || all === true) {
            const customers = await Customer.findAll({
                order: [['name', 'ASC']]
            });
            return res.status(200).json({
                success: true,
                message: 'All customers retrieved successfully',
                data: customers
            });
        }

        // Build where clause for search
        const whereClause = search ? {
            [require('sequelize').Op.or]: [
                { name: { [require('sequelize').Op.like]: `%${search}%` } },
                { mobile: { [require('sequelize').Op.like]: `%${search}%` } }
            ]
        } : {};

        const { count, rows: customers } = await Customer.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(count / parseInt(limit));
        const currentPage = parseInt(page);

        res.status(200).json({
            success: true,
            message: 'Customers retrieved successfully',
            data: customers,
            pagination: {
                currentPage: currentPage,
                totalPages: totalPages,
                totalItems: count,
                itemsPerPage: parseInt(limit),
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
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
