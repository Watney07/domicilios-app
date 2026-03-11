const express = require("express");
const router = express.Router();

const productosController = require("../controllers/productosController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

router.get("/", productosController.obtenerProductos);
// Solo admin puede crear/editar/eliminar productos (inventario).
router.post("/", auth, requireRole(["admin", 1]), productosController.crearProducto);
router.put("/:id", auth, requireRole(["admin", 1]), productosController.actualizarProducto);
router.delete("/:id", auth, requireRole(["admin", 1]), productosController.eliminarProducto);

module.exports = router;
