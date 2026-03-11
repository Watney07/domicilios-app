const db = require("../config/db");

function getEstadoId(nombre, callback) {
    db.query(
        "SELECT id_estado FROM estados_pedido WHERE nombre=? LIMIT 1",
        [nombre],
        (err, results) => {
            if (err) return callback(err);
            if (!results || results.length === 0) return callback(new Error("Estado no existe"));
            return callback(null, results[0].id_estado);
        }
    );
}

function verificarRepartidor(id_repartidor, callback) {
    const sql = `
        SELECT u.id_usuario
        FROM usuarios u
        LEFT JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario=? AND r.nombre='repartidor'
        LIMIT 1
    `;
    db.query(sql, [id_repartidor], (err, results) => {
        if (err) return callback(err);
        if (!results || results.length === 0) return callback(null, false);
        return callback(null, true);
    });
}

function obtenerPedidoBase(id_pedido, callback) {
    const sql = `
        SELECT
            p.*,
            ep.nombre AS estado,
            c.nombre AS cliente_nombre,
            c.direccion AS cliente_direccion,
            r.nombre AS repartidor_nombre
        FROM pedidos p
        LEFT JOIN estados_pedido ep ON ep.id_estado = p.id_estado
        LEFT JOIN usuarios c ON c.id_usuario = p.id_cliente
        LEFT JOIN usuarios r ON r.id_usuario = p.id_repartidor
        WHERE p.id_pedido=?
        LIMIT 1
    `;
    db.query(sql, [id_pedido], (err, results) => {
        if (err) return callback(err);
        if (!results || results.length === 0) return callback(null, null);
        return callback(null, results[0]);
    });
}

function obtenerDetallePedido(id_pedido, callback) {
    const sql = `
        SELECT
            dp.id_detalle, dp.id_producto, dp.cantidad, dp.precio_unitario,
            pr.nombre AS producto
        FROM detalle_pedido dp
        LEFT JOIN productos pr ON pr.id_producto = dp.id_producto
        WHERE dp.id_pedido=?
        ORDER BY dp.id_detalle ASC
    `;
    db.query(sql, [id_pedido], (err, results) => {
        if (err) return callback(err);
        return callback(null, results || []);
    });
}

// GET /api/pedidos
// Admin: todos, Cliente: propios, Repartidor: asignados.
exports.listarPedidos = (req, res) => {
    const role = req.user.rol;
    const idUser = req.user.id_usuario;

    let where = "";
    let params = [];

    if (role === "cliente") {
        where = "WHERE p.id_cliente=?";
        params = [idUser];
    } else if (role === "repartidor") {
        where = "WHERE p.id_repartidor=?";
        params = [idUser];
    }

    const sql = `
        SELECT
            p.id_pedido, p.id_cliente, p.id_repartidor, p.id_estado, p.direccion_entrega,
            p.total, p.fecha_pedido,
            ep.nombre AS estado,
            c.nombre AS cliente_nombre,
            r.nombre AS repartidor_nombre
        FROM pedidos p
        LEFT JOIN estados_pedido ep ON ep.id_estado = p.id_estado
        LEFT JOIN usuarios c ON c.id_usuario = p.id_cliente
        LEFT JOIN usuarios r ON r.id_usuario = p.id_repartidor
        ${where}
        ORDER BY p.id_pedido DESC
    `;

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// GET /api/pedidos/:id
exports.obtenerPedido = (req, res) => {
    const { id } = req.params;
    const role = req.user.rol;
    const idUser = req.user.id_usuario;

    obtenerPedidoBase(id, (err, pedido) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

        // Control de acceso por rol
        if (role === "cliente" && Number(pedido.id_cliente) !== Number(idUser)) {
            return res.status(403).json({ error: "No autorizado" });
        }
        if (role === "repartidor" && Number(pedido.id_repartidor) !== Number(idUser)) {
            return res.status(403).json({ error: "No autorizado" });
        }

        obtenerDetallePedido(id, (errDet, detalle) => {
            if (errDet) return res.status(500).json({ error: errDet.message });
            res.json({ pedido, detalle });
        });
    });
};

// POST /api/pedidos (solo cliente)
// body: { direccion_entrega?, items:[{id_producto,cantidad}] }
exports.crearPedido = (req, res) => {
    const idCliente = req.user.id_usuario;
    const { direccion_entrega, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items es requerido" });
    }

    getEstadoId("pendiente", (errEstado, idEstadoPendiente) => {
        if (errEstado) return res.status(500).json({ error: errEstado.message });

        db.beginTransaction((errTx) => {
            if (errTx) return res.status(500).json({ error: errTx.message });

            const detalleInsert = [];
            let total = 0;

            const procesarItem = (index) => {
                if (index >= items.length) return insertarPedido();

                const item = items[index] || {};
                const idProducto = item.id_producto;
                const cantidad = Number(item.cantidad || 0);

                if (!idProducto || cantidad <= 0) {
                    return rollback(400, "Item inválido");
                }

                db.query(
                    "SELECT id_producto, precio, stock, activo FROM productos WHERE id_producto=? LIMIT 1",
                    [idProducto],
                    (errProd, results) => {
                        if (errProd) return rollback(500, errProd.message);
                        if (!results || results.length === 0) return rollback(400, "Producto no existe");

                        const prod = results[0];
                        if (prod.activo === 0) return rollback(400, "Producto inactivo");
                        if (prod.stock < cantidad) return rollback(400, "Stock insuficiente");

                        total += Number(prod.precio) * cantidad;
                        detalleInsert.push({
                            id_producto: prod.id_producto,
                            cantidad,
                            precio_unitario: prod.precio
                        });

                        // Reserva stock (decrementa) dentro de la transacción.
                        db.query(
                            "UPDATE productos SET stock = stock - ? WHERE id_producto=?",
                            [cantidad, prod.id_producto],
                            (errUpd) => {
                                if (errUpd) return rollback(500, errUpd.message);
                                procesarItem(index + 1);
                            }
                        );
                    }
                );
            };

            const insertarPedido = () => {
                const sqlPedido = `
                    INSERT INTO pedidos (id_cliente, id_repartidor, id_estado, direccion_entrega, total, fecha_pedido)
                    VALUES (?, NULL, ?, ?, ?, NOW())
                `;

                db.query(
                    sqlPedido,
                    [idCliente, idEstadoPendiente, direccion_entrega || null, total],
                    (errIns, result) => {
                        if (errIns) return rollback(500, errIns.message);
                        const idPedido = result.insertId;
                        insertarDetalle(idPedido, 0);
                    }
                );
            };

            const insertarDetalle = (idPedido, idx) => {
                if (idx >= detalleInsert.length) return commit(idPedido);

                const d = detalleInsert[idx];
                const sqlDet = `
                    INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario)
                    VALUES (?, ?, ?, ?)
                `;
                db.query(
                    sqlDet,
                    [idPedido, d.id_producto, d.cantidad, d.precio_unitario],
                    (errDet) => {
                        if (errDet) return rollback(500, errDet.message);
                        insertarDetalle(idPedido, idx + 1);
                    }
                );
            };

            const commit = (idPedido) => {
                db.commit((errCommit) => {
                    if (errCommit) return rollback(500, errCommit.message);
                    res.json({ mensaje: "Pedido creado", id_pedido: idPedido, total });
                });
            };

            const rollback = (status, message) => {
                db.rollback(() => {
                    res.status(status).json({ error: message });
                });
            };

            procesarItem(0);
        });
    });
};

// PUT /api/pedidos/:id/estado (admin/repartidor)
// Repartidor solo puede cambiar estado de pedidos asignados a el.
exports.cambiarEstado = (req, res) => {
    const { id } = req.params;
    const { id_estado } = req.body;

    if (!id_estado) {
        return res.status(400).json({ error: "id_estado es requerido" });
    }

    obtenerPedidoBase(id, (err, pedido) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

        if (req.user.rol === "repartidor" && Number(pedido.id_repartidor) !== Number(req.user.id_usuario)) {
            return res.status(403).json({ error: "No autorizado" });
        }

        db.query(
            "UPDATE pedidos SET id_estado=? WHERE id_pedido=?",
            [id_estado, id],
            (errUpd) => {
                if (errUpd) return res.status(500).json({ error: errUpd.message });
                res.json({ mensaje: "Estado actualizado" });
            }
        );
    });
};

// PUT /api/pedidos/:id/asignar (solo admin)
// body: { id_repartidor }
exports.asignarRepartidor = (req, res) => {
    const { id } = req.params;
    const { id_repartidor } = req.body;

    if (!id_repartidor) {
        return res.status(400).json({ error: "id_repartidor es requerido" });
    }

    obtenerPedidoBase(id, (err, pedido) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

        verificarRepartidor(id_repartidor, (errRep, ok) => {
            if (errRep) return res.status(500).json({ error: errRep.message });
            if (!ok) return res.status(400).json({ error: "El usuario no es repartidor" });

            db.query(
                "UPDATE pedidos SET id_repartidor=? WHERE id_pedido=?",
                [id_repartidor, id],
                (errUpd) => {
                    if (errUpd) return res.status(500).json({ error: errUpd.message });
                    res.json({ mensaje: "Pedido asignado" });
                }
            );
        });
    });
};
