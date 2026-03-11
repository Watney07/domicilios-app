const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";

// Verifica JWT en Authorization: Bearer <token> y expone req.user.
module.exports = function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = String(header).split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Token requerido" });
    }

    try {
        const payload = jwt.verify(String(token).trim(), JWT_SECRET);
        req.user = payload;
        return next();
    } catch (e) {
        return res.status(401).json({ error: "Token inválido" });
    }
};

