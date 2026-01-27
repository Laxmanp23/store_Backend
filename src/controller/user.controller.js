const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../model');
const { where } = require('sequelize');

//SignUp User Api
exports.signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username, !email, !password) {
            return res.status(400).json({
                success: false,
                message: "All Field are Required"
            });
        };

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exist"
            });
        };

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });
        const token = jwt.sign({
            id: user.id,
            email: user.email,
            password: user.password
        },
            process.env.JWT_SECRET,
            { expiresIn: 24 }
        );
        res.status(201).json({
            success: true,
            message: "User has created",
            token,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    };
};

//Login User Api
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email, !password) {
            return res.status(400).json({
                success: false,
                message: "email or password are required!"
            });
        };

        const findUser = await User.findOne({ where: { email } });
        if (!findUser) {
            return res.status(401).json({
                success: false,
                message: "Invalid username and password"
            });
        };

        const isPasswordValid = await bcrypt.compare(password, findUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password"
            });
        };

        const token = jwt.sign({
            id: findUser.id,
            email: findUser.email,
            password: findUser.password
        },
            process.env.JWT_SECRET,
            { expiresIn: 24 }
        )
        res.status(200).json({
            success: true,
            message: "Login successfully",
            token,
            findUser: {
                username: findUser.username,
                email: findUser.email
            },

        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    };
};

// User Update Api
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password } = req.body;
        const findUser = await User.findByPk(id);
        if (!findUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10)

        await findUser.update({
            username: username,
            email: email,
            password: hashedPassword,
        })

        res.status(200).json({
            success: true,
            message: "User Updated"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}