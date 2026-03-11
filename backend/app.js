const express = require("express");
const db = require("./config/db");
const cors = require("cors");

const productosRoutes = require("./routes/productosRoutes");
const authRoutes = require("./routes/authRoutes");
const usuariosRoutes = require("./routes/usuariosRoutes");
const pedidosRoutes = require("./routes/pedidosRoutes");
const estadosPedidoRoutes = require("./routes/estadosPedidoRoutes");

const app = express();

app.use(express.json());

// Permite que el frontend (Vite) consuma la API desde http://localhost:5173.
// Si usas el proxy de Vite, igual es seguro dejar esto habilitado en desarrollo.
app.use(cors({
    origin: "http://localhost:5173"
}));

app.get("/", (req, res) => {
    res.json({ mensaje: "API funcionando" });
});

app.use("/api/productos", productosRoutes);
// Rutas de autenticacion (registro, login, verificacion 2FA).
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/estados-pedido", estadosPedidoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
