const express = require("express");
const app = express();
const port = 9001;
const bodyParser = require("body-parser");
const cors = require("cors");
const sequelize = require("./src/config/config.js");
const initializeCategories = require("./src/utils/init-db");

const  db = require("./src/model");
const userRoutes = require("./src/routes/user.routes");
const categoryRoutes = require("./src/routes/category.routes");
const productRoutes = require("./src/routes/product.routes");
const customerRoutes = require("./src/routes/customer.routes");
const stockRoutes = require("./src/routes/stock.routes");
const saleRoutes = require("./src/routes/sale.routes");
const paymentRoutes = require("./src/routes/payment.routes");
const vendorRoutes = require("./src/routes/vendor.routes");
const reportRoutes = require("./src/routes/report.routes");
const searchRoutes = require("./src/routes/search.routes");
const settingsRoutes = require("./src/routes/settings.routes");
const notificationRoutes = require("./src/routes/notification.routes");

app.use(express.json());

app.use(bodyParser.json());
app.use(cors());

app.get("/",(req,res)=>{
    res.send("This is a Server for Store Management System for Building Material Store");
})

// User routes
app.use("/api/user", userRoutes);

// Category routes
app.use("/api/category", categoryRoutes);

// Product routes
app.use("/api/product", productRoutes);

// Customer routes
app.use("/api/customer", customerRoutes);

// Stock routes
app.use("/api/stock", stockRoutes);

// Sale routes
app.use("/api/sale", saleRoutes);

// Payment routes
app.use("/api/payment", paymentRoutes);

// Vendor routes
app.use("/api/vendor", vendorRoutes);

// Report routes
app.use("/api/report", reportRoutes);

// Search routes
app.use("/api/search", searchRoutes);

// Settings routes
app.use("/api/settings", settingsRoutes);

// Notification routes
app.use("/api/notification", notificationRoutes);

// Krishi Kendra columns added - alter can stay false now
sequelize.sync({ force: false, alter: false })
    .then(async () => {
        // Initialize default categories
        // await initializeCategories();
        
        app.listen(port, '0.0.0.0',() => {
            console.log(`Server is running on http://localhost:${port}`);
        })
    })
    .catch((error) => {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    });
   