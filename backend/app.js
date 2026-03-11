const express = require("express");
const db = require("./config/db");

const productosRoutes = require("./routes/productosRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({ mensaje: "API funcionando" });
});

app.use("/api/productos", productosRoutes);

app.listen(3000, () => {
    console.log("Servidor corriendo en puerto 3000");
});