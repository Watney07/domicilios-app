const express = require("express");
const router = express.Router();

const estadosPedidoController = require("../controllers/estadosPedidoController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

router.get("/", auth, requireRole(["admin", "repartidor", 1, 3]), estadosPedidoController.listarEstados);

module.exports = router;

