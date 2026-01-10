const sequelize = require("./src/config/config.js");
const db = require("./src/model");

async function resetDatabase() {
  try {
    console.log('Starting database reset...');
    
    // Drop all tables
    await sequelize.sync({ force: true });
    
    console.log('✅ Database reset successfully! All tables have been recreated.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err.message);
    process.exit(1);
  }
}

resetDatabase();
