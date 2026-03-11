// Permite acceso solo a ciertos roles (por nombre o id_rol).
module.exports = function requireRole(allowed) {
    const allowedSet = new Set(Array.isArray(allowed) ? allowed : [allowed]);

    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({ error: "Token requerido" });
        }

        const roleName = req.user.rol;
        const roleId = req.user.id_rol;

        if (allowedSet.has(roleName) || allowedSet.has(roleId)) {
            return next();
        }

        return res.status(403).json({ error: "No autorizado" });
    };
};

