const sequelize = require('./src/config/config.js');

async function addOriginalQuantityColumn() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected!');

        // Check if column exists
        const [results] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'storedb' 
            AND TABLE_NAME = 'Stocks' 
            AND COLUMN_NAME = 'originalQuantity'
        `);

        if (results.length > 0) {
            console.log('Column originalQuantity already exists!');
            
            // Update existing records where originalQuantity is 0
            console.log('Updating records where originalQuantity = 0...');
            const [updateResult] = await sequelize.query(`
                UPDATE Stocks SET originalQuantity = quantity WHERE originalQuantity = 0
            `);
            console.log('Records updated!');
        } else {
            // Add column
            console.log('Adding originalQuantity column...');
            await sequelize.query(`
                ALTER TABLE Stocks 
                ADD COLUMN originalQuantity INT NOT NULL DEFAULT 0 
                AFTER salePrice
            `);
            console.log('Column added!');

            // Set originalQuantity = quantity for existing records
            console.log('Setting originalQuantity = quantity for existing records...');
            await sequelize.query(`
                UPDATE Stocks SET originalQuantity = quantity
            `);
            console.log('Existing records updated!');
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

addOriginalQuantityColumn();
