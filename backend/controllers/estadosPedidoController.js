const db = require("../config/db");

// GET /api/estados-pedido (repartidor/admin)
exports.listarEstados = (req, res) => {
    db.query("SELECT * FROM estados_pedido ORDER BY id_estado ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

