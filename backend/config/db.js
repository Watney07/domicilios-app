const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "domicilios_db"
});

connection.connect((err) => {
    if (err) {
        console.error("Error conectando:", err);
        return;
    }

    console.log("Conectado a MySQL");
});

module.exports = connection;