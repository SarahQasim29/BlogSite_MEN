
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || '4715aed3c946f7b0a38e6b534a9583628d84e96d10fbc04700770d572af3dce43625dd';

function authenticateToken(req, res, next) {
    // Get the token from cookies
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/user/login'); // Redirect to login if no token is found
    }

    // Verify the token
    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            console.error('Token verification failed:', err.message); // Log the error
            return res.redirect('/user/login'); // Redirect to login if token is invalid
        }

        // Store decoded user information in request object
        req.user = decoded.user; // Adjusted from req.admin to req.user to match payload in login
        next(); // Proceed to the next middleware or route handler
    });
}

module.exports = authenticateToken;