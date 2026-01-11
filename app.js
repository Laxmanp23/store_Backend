const express = require("express");
const app = express();
const port = 9001;
const bodyParser = require("body-parser");
const cors = require("cors");
const sequelize = require("./src/config/config.js");

const  db = require("./src/model");
const userRoutes = require("./src/routes/user.routes");
const productRoutes = require("./src/routes/product.routes");
const customerRoutes = require("./src/routes/customer.routes");
const stockRoutes = require("./src/routes/stock.routes");
const saleRoutes = require("./src/routes/sale.routes");
const paymentRoutes = require("./src/routes/payment.routes");

app.use(bodyParser.json());
app.use(cors());

app.get("/",(req,res)=>{
    res.send("This is a Server for Store Management Application backend");
})

// User routes
app.use("/api/user", userRoutes);

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

sequelize.sync({ force: false, alter: true })
    .then(() => {
        app.listen(port, '0.0.0.0',() => {
            console.log(`Server is running on http://localhost:${port}`);
        })
    })
    .catch(err => {
        console.error('Database connection error:', err.message);
        process.exit(1);
    });