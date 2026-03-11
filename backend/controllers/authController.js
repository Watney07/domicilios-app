const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

// Configuracion JWT (para proyecto estudiantil).
// Recomendado: definir JWT_SECRET en variables de entorno.
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
// Token temporal usado solo para el paso intermedio "password OK -> falta 2FA".
const JWT_2FA_EXPIRES_IN = process.env.JWT_2FA_EXPIRES_IN || "15m";

// Normaliza el email para evitar duplicados por mayusculas/espacios.
function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// Permite asignar rol por id_rol (directo) o por nombre (rol).
// Si no se envia nada, usa 1 como rol por defecto (ajustable a tu BD).
function resolverRol({ id_rol, rol }, callback) {
    if (id_rol) {
        return callback(null, Number(id_rol));
    }

    if (rol) {
        db.query(
            "SELECT id_rol FROM roles WHERE nombre=? LIMIT 1",
            [rol],
            (err, results) => {
                if (err) return callback(err);
                if (!results || results.length === 0) return callback(null, 1);
                return callback(null, results[0].id_rol);
            }
        );
        return;
    }

    return callback(null, 1);
}

// POST /api/auth/register
// Crea usuario, hashea password, genera secreto 2FA (base32), lo guarda y devuelve QR.
exports.register = (req, res) => {

    const { nombre, email, password, telefono, direccion, id_rol, rol } = req.body;
    const emailNorm = normalizarEmail(email);

    if (!nombre || !emailNorm || !password) {
        return res.status(400).json({ error: "nombre, email y password son requeridos" });
    }

    db.query(
        "SELECT id_usuario FROM usuarios WHERE email=? LIMIT 1",
        [emailNorm],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results && results.length > 0) {
                return res.status(409).json({ error: "El email ya está registrado" });
            }

            resolverRol({ id_rol, rol }, (errRol, idRolFinal) => {
                if (errRol) return res.status(500).json({ error: errRol.message });

                // Hash del password (bcrypt) para no guardar password plano.
                bcrypt.hash(password, 10, (errHash, passwordHash) => {
                    if (errHash) return res.status(500).json({ error: errHash.message });

                    // Secreto 2FA para apps tipo Google Authenticator / Authy.
                    // base32: lo guardamos en BD
                    // otpauth_url: se usa para crear el QR
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

                            // Devuelve el QR en base64 (data URL) para escanearlo desde el frontend.
                            qrcode.toDataURL(secret.otpauth_url, (errQr, qrCode) => {
                                if (errQr) return res.status(500).json({ error: errQr.message });

                                res.json({
                                    mensaje: "Usuario registrado",
                                    id: result.insertId,
                                    qrCode,
                                    otpauth_url: secret.otpauth_url
                                });
                            });
                        }
                    );
                });
            });
        }
    );

};

// POST /api/auth/login
// Valida email+password. Si esta OK, NO entrega JWT final: devuelve tempToken para el paso 2FA.
exports.login = (req, res) => {

    const { email, password } = req.body;
    const emailNorm = normalizarEmail(email);

    if (!emailNorm || !password) {
        return res.status(400).json({ error: "email y password son requeridos" });
    }

    const sql = `
        SELECT
            u.id_usuario, u.nombre, u.email, u.password, u.id_rol, u.twofa_secret,
            r.nombre AS rol
        FROM usuarios u
        LEFT JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.email=?
        LIMIT 1
    `;

    db.query(sql, [emailNorm], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = results[0];

        // Compara password enviado vs hash en BD.
        bcrypt.compare(password, user.password, (errCompare, ok) => {
            if (errCompare) return res.status(500).json({ error: errCompare.message });
            if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

            if (!user.twofa_secret) {
                return res.status(400).json({ error: "El usuario no tiene 2FA configurado" });
            }

            // Token temporal: sirve para identificar al usuario en verify-2fa.
            // Incluye stage="2fa" para evitar que se use como token final.
            const tempToken = jwt.sign(
                { sub: user.id_usuario, stage: "2fa" },
                JWT_SECRET,
                { expiresIn: JWT_2FA_EXPIRES_IN }
            );

            res.json({
                mensaje: "2FA requerido",
                requires2FA: true,
                tempToken,
                usuario: {
                    id_usuario: user.id_usuario,
                    nombre: user.nombre,
                    email: user.email,
                    id_rol: user.id_rol,
                    rol: user.rol || null
                }
            });
        });
    });

};

// POST /api/auth/verify-2fa
// Recibe tempToken + codigo TOTP. Si el codigo es valido, entrega el JWT final (sesion).
exports.verify2fa = (req, res) => {

    const { tempToken, code, token, codigo } = req.body;
    const totp = code || token || codigo;

    if (!tempToken || !totp) {
        return res.status(400).json({ error: "tempToken y code son requeridos" });
    }

    let payload;
    const tempTokenStr = String(tempToken).trim();
    try {
        // Verifica firma y expiracion del tempToken.
        payload = jwt.verify(tempTokenStr, JWT_SECRET);
    } catch (e) {
        if (e && e.name === "TokenExpiredError") {
            return res.status(401).json({ error: "tempToken expirado", detail: e.name, detail_message: e.message });
        }
        return res.status(401).json({
            error: "tempToken inválido",
            detail: (e && e.name) ? e.name : null,
            detail_message: (e && e.message) ? e.message : null
        });
    }

    // Validacion extra: este token debe ser "solo para 2fa".
    if (!payload || payload.stage !== "2fa" || !payload.sub) {
        return res.status(401).json({ error: "tempToken inválido" });
    }

    const sql = `
        SELECT
            u.id_usuario, u.nombre, u.email, u.id_rol, u.twofa_secret,
            r.nombre AS rol
        FROM usuarios u
        LEFT JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario=?
        LIMIT 1
    `;

    db.query(sql, [payload.sub], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const user = results[0];

        // Valida el codigo TOTP (6 digitos) contra el secreto guardado.
        // window: 1 permite un pequeno margen por desajustes de reloj.
        const ok = speakeasy.totp.verify({
            secret: user.twofa_secret,
            encoding: "base32",
            token: String(totp).trim(),
            window: 1
        });

        if (!ok) {
            return res.status(401).json({ error: "Código 2FA inválido" });
        }

        // JWT final: este es el que debe usar el frontend en Authorization: Bearer <token>.
        const authToken = jwt.sign(
            {
                id_usuario: user.id_usuario,
                email: user.email,
                id_rol: user.id_rol,
                rol: user.rol || null
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            mensaje: "Autenticación exitosa",
            token: authToken,
            usuario: {
                id_usuario: user.id_usuario,
                nombre: user.nombre,
                email: user.email,
                id_rol: user.id_rol,
                rol: user.rol || null
            }
        });
    });

};

// GET /api/auth/me
// Devuelve el payload del JWT (usuario logueado).
exports.me = (req, res) => {
    res.json({ usuario: req.user });
};
