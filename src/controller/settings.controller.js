const { Settings } = require('../model');

// Get all settings
const getAllSettings = async (req, res) => {
    try {
        const { category } = req.query;
        
        const whereClause = category ? { category } : {};
        const settings = await Settings.findAll({
            where: whereClause,
            order: [['category', 'ASC'], ['key', 'ASC']]
        });

        // Convert to key-value object for easier frontend use
        const settingsObject = {};
        settings.forEach(setting => {
            try {
                // Try to parse JSON values
                settingsObject[setting.key] = JSON.parse(setting.value);
            } catch {
                settingsObject[setting.key] = setting.value;
            }
        });

        res.status(200).json({
            success: true,
            data: settingsObject,
            raw: settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get settings',
            error: error.message
        });
    }
};

// Get single setting by key
const getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        
        const setting = await Settings.findOne({ where: { key } });
        
        if (!setting) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        let value;
        try {
            value = JSON.parse(setting.value);
        } catch {
            value = setting.value;
        }

        res.status(200).json({
            success: true,
            data: { key: setting.key, value, category: setting.category }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get setting',
            error: error.message
        });
    }
};

// Update or create a setting
const upsertSetting = async (req, res) => {
    try {
        const { key, value, category = 'general', description } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: 'Key is required'
            });
        }

        // Convert value to string if it's an object
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        const [setting, created] = await Settings.upsert({
            key,
            value: valueStr,
            category,
            description
        }, {
            returning: true
        });

        res.status(200).json({
            success: true,
            message: created ? 'Setting created' : 'Setting updated',
            data: setting
        });
    } catch (error) {
        console.error('Upsert setting error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save setting',
            error: error.message
        });
    }
};

// Bulk update settings
const bulkUpdateSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({
                success: false,
                message: 'Settings array is required'
            });
        }

        const results = [];
        for (const item of settings) {
            const valueStr = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
            
            const [setting] = await Settings.upsert({
                key: item.key,
                value: valueStr,
                category: item.category || 'general',
                description: item.description
            });
            results.push(setting);
        }

        res.status(200).json({
            success: true,
            message: `${results.length} settings updated`,
            data: results
        });
    } catch (error) {
        console.error('Bulk update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
};

// Get bill settings specifically
const getBillSettings = async (req, res) => {
    try {
        // Fetch both bill and general settings
        const settings = await Settings.findAll({
            where: { 
                category: {
                    [require('sequelize').Op.in]: ['bill', 'general']
                }
            }
        });

        // Default bill settings
        const defaultSettings = {
            shopName: 'My Store',
            shopAddress: '',
            shopPhone: '',
            shopEmail: '',
            shopGSTIN: '',
            shopPAN: '',
            shopLogo: '',
            billPrefix: 'INV',
            billFooter: 'Thank you for your business!',
            showLogo: true,
            showGSTIN: true,
            showTerms: true,
            termsAndConditions: 'Goods once sold will not be returned or exchanged.',
            // GST defaults
            gstEnabled: false,
            gstRate: '18',
            gstType: 'exclusive',
            showGSTBreakdown: true,
            // General defaults
            lowStockAlert: '10',
            currency: '\u20b9'
        };

        // Merge with saved settings
        settings.forEach(setting => {
            try {
                defaultSettings[setting.key] = JSON.parse(setting.value);
            } catch {
                defaultSettings[setting.key] = setting.value;
            }
        });

        res.status(200).json({
            success: true,
            data: defaultSettings
        });
    } catch (error) {
        console.error('Get bill settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bill settings',
            error: error.message
        });
    }
};

// Save bill settings
const saveBillSettings = async (req, res) => {
    try {
        const billSettings = req.body;
        
        const settingsToSave = [
            { key: 'shopName', value: billSettings.shopName || '', category: 'bill' },
            { key: 'shopAddress', value: billSettings.shopAddress || '', category: 'bill' },
            { key: 'shopPhone', value: billSettings.shopPhone || '', category: 'bill' },
            { key: 'shopEmail', value: billSettings.shopEmail || '', category: 'bill' },
            { key: 'shopGSTIN', value: billSettings.shopGSTIN || '', category: 'bill' },
            { key: 'shopPAN', value: billSettings.shopPAN || '', category: 'bill' },
            { key: 'shopLogo', value: billSettings.shopLogo || '', category: 'bill' },
            { key: 'billPrefix', value: billSettings.billPrefix || 'INV', category: 'bill' },
            { key: 'billFooter', value: billSettings.billFooter || '', category: 'bill' },
            { key: 'showLogo', value: billSettings.showLogo ?? true, category: 'bill' },
            { key: 'showGSTIN', value: billSettings.showGSTIN ?? true, category: 'bill' },
            { key: 'showTerms', value: billSettings.showTerms ?? true, category: 'bill' },
            { key: 'termsAndConditions', value: billSettings.termsAndConditions || '', category: 'bill' },
            // GST Settings (saved to 'general' category)
            { key: 'gstEnabled', value: billSettings.gstEnabled ?? false, category: 'general' },
            { key: 'gstRate', value: billSettings.gstRate || '18', category: 'general' },
            { key: 'gstType', value: billSettings.gstType || 'exclusive', category: 'general' },
            { key: 'showGSTBreakdown', value: billSettings.showGSTBreakdown ?? true, category: 'general' },
            // Other general settings
            { key: 'lowStockAlert', value: billSettings.lowStockAlert || '10', category: 'general' },
            { key: 'currency', value: billSettings.currency || '₹', category: 'general' }
        ];

        for (const item of settingsToSave) {
            const valueStr = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
            await Settings.upsert({
                key: item.key,
                value: valueStr,
                category: item.category
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bill settings saved successfully'
        });
    } catch (error) {
        console.error('Save bill settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save bill settings',
            error: error.message
        });
    }
};

// Delete a setting
const deleteSetting = async (req, res) => {
    try {
        const { key } = req.params;
        
        const deleted = await Settings.destroy({ where: { key } });
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Setting deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete setting',
            error: error.message
        });
    }
};

module.exports = {
    getAllSettings,
    getSetting,
    upsertSetting,
    bulkUpdateSettings,
    getBillSettings,
    saveBillSettings,
    deleteSetting
};
