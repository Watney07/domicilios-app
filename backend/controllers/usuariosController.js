const db = require("../config/db");
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function resolverRol({ id_rol, rol }, callback) {
    if (id_rol) return callback(null, Number(id_rol));

    if (rol) {
        db.query(
            "SELECT id_rol FROM roles WHERE nombre=? LIMIT 1",
            [rol],
            (err, results) => {
                if (err) return callback(err);
                if (!results || results.length === 0) return callback(new Error("Rol no existe"));
                return callback(null, results[0].id_rol);
            }
        );
        return;
    }

    return callback(new Error("id_rol o rol es requerido"));
}

// GET /api/usuarios (admin)
exports.listarUsuarios = (req, res) => {
    const sql = `
        SELECT
            u.id_usuario, u.nombre, u.email, u.telefono, u.direccion, u.id_rol,
            r.nombre AS rol
        FROM usuarios u
        LEFT JOIN roles r ON r.id_rol = u.id_rol
        ORDER BY u.id_usuario DESC
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// POST /api/usuarios (admin)
// Crea un usuario y devuelve QR para configurar 2FA (igual que register, pero para admin).
exports.crearUsuario = (req, res) => {
    const { nombre, email, password, telefono, direccion, id_rol, rol } = req.body;
    const emailNorm = normalizarEmail(email);

    if (!nombre || !emailNorm || !password) {
        return res.status(400).json({ error: "nombre, email y password son requeridos" });
    }

    resolverRol({ id_rol, rol }, (errRol, idRolFinal) => {
        if (errRol) return res.status(400).json({ error: errRol.message });

        db.query(
            "SELECT id_usuario FROM usuarios WHERE email=? LIMIT 1",
            [emailNorm],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                if (results && results.length > 0) {
                    return res.status(409).json({ error: "El email ya está registrado" });
                }

                bcrypt.hash(password, 10, (errHash, passwordHash) => {
                    if (errHash) return res.status(500).json({ error: errHash.message });

                    const secret = speakeasy.generateSecret({
                        name: `Domicilios (${emailNorm})`
                    });

                    const sql = `
                        INSERT INTO usuarios (nombre, email, password, telefono, direccion, id_rol, twofa_secret)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        sql,
                        [nombre, emailNorm, passwordHash, telefono || null, direccion || null, idRolFinal, secret.base32],
                        (errInsert, result) => {
                            if (errInsert) return res.status(500).json({ error: errInsert.message });

                            qrcode.toDataURL(secret.otpauth_url, (errQr, qrCode) => {
                                if (errQr) return res.status(500).json({ error: errQr.message });

                                res.json({
                                    mensaje: "Usuario creado",
                                    id: result.insertId,
                                    qrCode,
                                    otpauth_url: secret.otpauth_url
                                });
                            });
                        }
                    );
                });
            }
        );
    });
};

// PUT /api/usuarios/:id/rol (admin)
exports.cambiarRol = (req, res) => {
    const { id } = req.params;
    const { id_rol, rol } = req.body;

    resolverRol({ id_rol, rol }, (errRol, idRolFinal) => {
        if (errRol) return res.status(400).json({ error: errRol.message });

        db.query(
            "UPDATE usuarios SET id_rol=? WHERE id_usuario=?",
            [idRolFinal, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ mensaje: "Rol actualizado" });
            }
        );
    });
};

