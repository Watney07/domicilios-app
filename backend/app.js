const express = require("express");
const db = require("./config/db");

const productosRoutes = require("./routes/productosRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({ mensaje: "API funcionando" });
});

app.use("/api/productos", productosRoutes);
// Rutas de autenticacion (registro, login, verificacion 2FA).
app.use("/api/auth", authRoutes);

app.listen(3000, () => {
    console.log("Servidor corriendo en puerto 3000");
});
