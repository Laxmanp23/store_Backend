const { Category } = require('../model');

// Default categories to initialize
const defaultCategories = [
    { name: 'Electronics', description: 'Electronic devices and components' },
    { name: 'Clothing', description: 'Apparel and clothing items' },
    { name: 'Tools', description: 'Tools and hardware' },
    { name: 'Home & Garden', description: 'Home and garden products' },
    { name: 'Sports & Outdoors', description: 'Sports and outdoor equipment' },
    { name: 'Books & Media', description: 'Books and media items' },
    { name: 'Toys & Games', description: 'Toys and games for all ages' },
    { name: 'Other', description: 'Miscellaneous items' }
];

async function initializeCategories() {
    try {
        console.log('\n📦 Initializing default categories...');
        let createdCount = 0;
        
        for (const category of defaultCategories) {
            try {
                const exists = await Category.findOne({ 
                    where: { name: category.name } 
                });
                
                if (!exists) {
                    await Category.create(category);
                    console.log(`  ✓ Created category: ${category.name}`);
                    createdCount++;
                } else {
                    console.log(`  ○ Category already exists: ${category.name}`);
                }
            } catch (err) {
                console.error(`  ✗ Error creating category ${category.name}:`, err.message);
            }
        }
        
        console.log(`\n✓ Default categories initialized (${createdCount} new created)\n`);
    } catch (error) {
        console.error('Error initializing categories:', error.message);
    }
}

module.exports = initializeCategories;
