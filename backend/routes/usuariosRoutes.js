const express = require("express");
const router = express.Router();

const usuariosController = require("../controllers/usuariosController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

// Admin: ver/crear usuarios y cambiar roles.
router.get("/", auth, requireRole(["admin", 1]), usuariosController.listarUsuarios);
router.post("/", auth, requireRole(["admin", 1]), usuariosController.crearUsuario);
router.put("/:id/rol", auth, requireRole(["admin", 1]), usuariosController.cambiarRol);

module.exports = router;

