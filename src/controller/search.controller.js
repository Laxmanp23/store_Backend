const { Op } = require('sequelize');
const { Product, Customer, Sale, Stock, Vendor, Category, Payment } = require('../model');

// Global search across multiple entities
const globalSearch = async (req, res) => {
    try {
        const { q, type, limit = 10 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const searchTerm = q.trim();
        const searchLimit = Math.min(parseInt(limit) || 10, 50);
        const results = {};

        // If type is specified, search only that entity
        const searchTypes = type ? [type] : ['products', 'customers', 'sales', 'vendors', 'stock'];

        // Search Products
        if (searchTypes.includes('products')) {
            const products = await Product.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: `%${searchTerm}%` } },
                        { sku: { [Op.like]: `%${searchTerm}%` } },
                        { description: { [Op.like]: `%${searchTerm}%` } }
                    ]
                },
                include: [{ model: Category, as: 'Category', attributes: ['id', 'name'] }],
                limit: searchLimit,
                order: [['name', 'ASC']]
            });
            
            results.products = products.map(p => {
                const salePrice = parseFloat(p.costPrice) * (1 + parseFloat(p.marginPercent || 10) / 100);
                return {
                    id: p.id,
                    type: 'product',
                    title: p.name,
                    subtitle: `SKU: ${p.sku || 'N/A'} | Price: ₹${salePrice.toFixed(2)}`,
                    category: p.Category?.name || 'Uncategorized',
                    link: `/products`,
                    data: p
                };
            });
        }

        // Search Customers
        if (searchTypes.includes('customers')) {
            const customers = await Customer.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: `%${searchTerm}%` } },
                        { mobile: { [Op.like]: `%${searchTerm}%` } },
                        { address: { [Op.like]: `%${searchTerm}%` } }
                    ]
                },
                limit: searchLimit,
                order: [['name', 'ASC']]
            });
            
            results.customers = customers.map(c => ({
                id: c.id,
                type: 'customer',
                title: c.name,
                subtitle: `📱 ${c.mobile || 'N/A'}`,
                link: `/customers`,
                data: c
            }));
        }

        // Search Sales (by invoice number or customer name)
        if (searchTypes.includes('sales')) {
            const sales = await Sale.findAll({
                where: {
                    [Op.or]: [
                        { invoiceNumber: { [Op.like]: `%${searchTerm}%` } }
                    ]
                },
                include: [
                    { model: Customer, attributes: ['id', 'name', 'mobile'] }
                ],
                limit: searchLimit,
                order: [['createdAt', 'DESC']]
            });

            // Also search by customer name
            const salesByCustomer = await Sale.findAll({
                include: [
                    { 
                        model: Customer, 
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: `%${searchTerm}%` } },
                                { mobile: { [Op.like]: `%${searchTerm}%` } }
                            ]
                        },
                        attributes: ['id', 'name', 'mobile']
                    }
                ],
                limit: searchLimit,
                order: [['createdAt', 'DESC']]
            });

            // Merge and deduplicate
            const allSales = [...sales, ...salesByCustomer];
            const uniqueSales = allSales.filter((sale, index, self) =>
                index === self.findIndex(s => s.id === sale.id)
            ).slice(0, searchLimit);
            
            results.sales = uniqueSales.map(s => ({
                id: s.id,
                type: 'sale',
                title: `Invoice #${s.invoiceNumber}`,
                subtitle: `${s.Customer?.name || 'Unknown'} | ₹${s.grandTotal} | ${s.paymentStatus}`,
                status: s.paymentStatus,
                link: `/sales/view/${s.id}`,
                data: s
            }));
        }

        // Search Vendors
        if (searchTypes.includes('vendors')) {
            const vendors = await Vendor.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: `%${searchTerm}%` } },
                        { mobile: { [Op.like]: `%${searchTerm}%` } },
                        { email: { [Op.like]: `%${searchTerm}%` } },
                        { companyName: { [Op.like]: `%${searchTerm}%` } }
                    ]
                },
                limit: searchLimit,
                order: [['name', 'ASC']]
            });
            
            results.vendors = vendors.map(v => ({
                id: v.id,
                type: 'vendor',
                title: v.name,
                subtitle: `${v.companyName || ''} | 📱 ${v.mobile || 'N/A'}`,
                link: `/vendors`,
                data: v
            }));
        }

        // Search Stock (by product name or batch number)
        if (searchTypes.includes('stock')) {
            const stocks = await Stock.findAll({
                include: [
                    { 
                        model: Product, 
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: `%${searchTerm}%` } },
                                { sku: { [Op.like]: `%${searchTerm}%` } }
                            ]
                        },
                        attributes: ['id', 'name', 'sku'],
                        include: [{ model: Category, as: 'Category', attributes: ['id', 'name'] }]
                    }
                ],
                where: {
                    quantity: { [Op.gt]: 0 }
                },
                limit: searchLimit,
                order: [['createdAt', 'DESC']]
            });
            
            results.stock = stocks.map(s => ({
                id: s.id,
                type: 'stock',
                title: s.Product?.name || 'Unknown Product',
                subtitle: `Qty: ${s.quantity} | Purchase: ₹${s.purchasePrice} | Sale: ₹${s.salePrice}`,
                quantity: s.quantity,
                link: `/stock`,
                data: s
            }));
        }

        // Calculate total count
        const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

        res.status(200).json({
            success: true,
            query: searchTerm,
            totalCount,
            data: results
        });

    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: error.message
        });
    }
};

// Quick search for autocomplete (lighter weight)
const quickSearch = async (req, res) => {
    try {
        const { q, limit = 8 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.json({ success: true, data: [] });
        }

        const searchTerm = q.trim();
        const searchLimit = Math.min(parseInt(limit) || 8, 20);
        const suggestions = [];

        // Quick search products
        const products = await Product.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${searchTerm}%` } },
                    { sku: { [Op.like]: `%${searchTerm}%` } }
                ]
            },
            attributes: ['id', 'name', 'sku', 'costPrice', 'marginPercent'],
            limit: 3
        });
        
        products.forEach(p => {
            const salePrice = parseFloat(p.costPrice) * (1 + parseFloat(p.marginPercent || 10) / 100);
            suggestions.push({
                id: p.id,
                type: 'product',
                icon: '📦',
                title: p.name,
                subtitle: `₹${salePrice.toFixed(2)}`,
                link: '/products'
            });
        });

        // Quick search customers
        const customers = await Customer.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${searchTerm}%` } },
                    { mobile: { [Op.like]: `%${searchTerm}%` } }
                ]
            },
            attributes: ['id', 'name', 'mobile'],
            limit: 3
        });
        
        customers.forEach(c => {
            suggestions.push({
                id: c.id,
                type: 'customer',
                icon: '👤',
                title: c.name,
                subtitle: c.mobile || '',
                link: '/customers'
            });
        });

        // Quick search sales
        const sales = await Sale.findAll({
            where: {
                invoiceNumber: { [Op.like]: `%${searchTerm}%` }
            },
            include: [{ model: Customer, attributes: ['name'] }],
            limit: 2
        });
        
        sales.forEach(s => {
            suggestions.push({
                id: s.id,
                type: 'sale',
                icon: '🧾',
                title: `#${s.invoiceNumber}`,
                subtitle: s.Customer?.name || 'Unknown',
                link: `/sales/view/${s.id}`
            });
        });

        res.json({
            success: true,
            data: suggestions.slice(0, searchLimit)
        });

    } catch (error) {
        console.error('Quick search error:', error);
        res.json({ success: true, data: [] });
    }
};

// Advanced search with filters
const advancedSearch = async (req, res) => {
    try {
        const { 
            q,
            type,           // product, customer, sale, vendor
            category,       // category id for products
            priceMin,       // min price
            priceMax,       // max price
            dateFrom,       // start date for sales
            dateTo,         // end date for sales
            status,         // payment status for sales
            inStock,        // true/false for products with stock
            limit = 20,
            offset = 0
        } = req.query;

        const searchLimit = Math.min(parseInt(limit) || 20, 100);
        const searchOffset = parseInt(offset) || 0;

        if (type === 'products' || !type) {
            const productWhere = {};
            const stockWhere = {};

            if (q) {
                productWhere[Op.or] = [
                    { name: { [Op.like]: `%${q}%` } },
                    { sku: { [Op.like]: `%${q}%` } },
                    { description: { [Op.like]: `%${q}%` } }
                ];
            }

            if (category) {
                productWhere.CategoryId = category;
            }

            if (priceMin) {
                productWhere.salePrice = { ...(productWhere.salePrice || {}), [Op.gte]: parseFloat(priceMin) };
            }

            if (priceMax) {
                productWhere.salePrice = { ...(productWhere.salePrice || {}), [Op.lte]: parseFloat(priceMax) };
            }

            const includeOptions = [
                { model: Category, as: 'Category', attributes: ['id', 'name'] }
            ];

            if (inStock === 'true') {
                includeOptions.push({
                    model: Stock,
                    where: { quantity: { [Op.gt]: 0 } },
                    required: true
                });
            }

            const products = await Product.findAndCountAll({
                where: productWhere,
                include: includeOptions,
                limit: searchLimit,
                offset: searchOffset,
                order: [['name', 'ASC']],
                distinct: true
            });

            return res.json({
                success: true,
                type: 'products',
                total: products.count,
                data: products.rows,
                pagination: {
                    limit: searchLimit,
                    offset: searchOffset,
                    hasMore: searchOffset + searchLimit < products.count
                }
            });
        }

        if (type === 'sales') {
            const saleWhere = {};
            const customerWhere = {};

            if (q) {
                saleWhere[Op.or] = [
                    { invoiceNumber: { [Op.like]: `%${q}%` } }
                ];
                customerWhere[Op.or] = [
                    { name: { [Op.like]: `%${q}%` } },
                    { mobile: { [Op.like]: `%${q}%` } }
                ];
            }

            if (dateFrom) {
                saleWhere.createdAt = { ...(saleWhere.createdAt || {}), [Op.gte]: new Date(dateFrom) };
            }

            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                saleWhere.createdAt = { ...(saleWhere.createdAt || {}), [Op.lte]: endDate };
            }

            if (status) {
                saleWhere.paymentStatus = status;
            }

            if (priceMin) {
                saleWhere.grandTotal = { ...(saleWhere.grandTotal || {}), [Op.gte]: parseFloat(priceMin) };
            }

            if (priceMax) {
                saleWhere.grandTotal = { ...(saleWhere.grandTotal || {}), [Op.lte]: parseFloat(priceMax) };
            }

            const sales = await Sale.findAndCountAll({
                where: saleWhere,
                include: [
                    { 
                        model: Customer, 
                        where: q ? customerWhere : undefined,
                        required: q ? false : false,
                        attributes: ['id', 'name', 'mobile'] 
                    }
                ],
                limit: searchLimit,
                offset: searchOffset,
                order: [['createdAt', 'DESC']],
                distinct: true
            });

            return res.json({
                success: true,
                type: 'sales',
                total: sales.count,
                data: sales.rows,
                pagination: {
                    limit: searchLimit,
                    offset: searchOffset,
                    hasMore: searchOffset + searchLimit < sales.count
                }
            });
        }

        // Default: return empty
        res.json({
            success: true,
            type: type || 'unknown',
            total: 0,
            data: []
        });

    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({
            success: false,
            message: 'Advanced search failed',
            error: error.message
        });
    }
};

module.exports = {
    globalSearch,
    quickSearch,
    advancedSearch
};
