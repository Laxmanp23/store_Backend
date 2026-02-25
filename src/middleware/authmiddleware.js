const jwt = require("jsonwebtoken")

function authmiddleware(req,res,next){
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({
            success: false,
            message: "Token is missing"
        });
    };

    const token = authHeader.split(" ")[1];
    try{
        const decode = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decode;
        next()

    }catch(error){
        return res.status(401).json({
            success: false,
            message: error.message === 'jwt expired' ? "Token has expired" : "Invalid Token"
        })
    }
}

module.exports = authmiddleware;