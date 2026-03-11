const express = require("express");
const router = express.Router();

const pedidosController = require("../controllers/pedidosController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

// Admin/Cliente/Repartidor: listar segun reglas internas del controlador.
router.get("/", auth, requireRole(["admin", "cliente", "repartidor", 1, 2, 3]), pedidosController.listarPedidos);
router.get("/:id", auth, requireRole(["admin", "cliente", "repartidor", 1, 2, 3]), pedidosController.obtenerPedido);

// Cliente: crear pedido.
router.post("/", auth, requireRole(["cliente", 2]), pedidosController.crearPedido);

// Admin/Repartidor: cambiar estado.
router.put("/:id/estado", auth, requireRole(["admin", "repartidor", 1, 3]), pedidosController.cambiarEstado);
// Admin: asignar repartidor a pedido.
router.put("/:id/asignar", auth, requireRole(["admin", 1]), pedidosController.asignarRepartidor);

module.exports = router;
