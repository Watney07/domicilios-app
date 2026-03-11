CREATE DATABASE domicilios_db;
USE domicilios_db;

-- Tabla de roles
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla de usuarios
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    id_rol INT,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- Tabla de productos
CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de estados de pedido
CREATE TABLE estados_pedido (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla de pedidos
CREATE TABLE pedidos (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT,
    id_repartidor INT,
    id_estado INT,
    direccion_entrega VARCHAR(255),
    total DECIMAL(10,2),
    fecha_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_repartidor) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_estado) REFERENCES estados_pedido(id_estado)
);

-- Tabla detalle pedido (tabla puente M:N)
CREATE TABLE detalle_pedido (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT,
    id_producto INT,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2),
    
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- Requerido para el 2AF
ALTER TABLE usuarios
ADD COLUMN twofa_secret
VARCHAR(255) NULL;

-- Imagenes
ALTER TABLE productos
ADD COLUMN imagen_url VARCHAR(500) NULL;

-- Categorías
ALTER TABLE productos
ADD COLUMN categoria VARCHAR(100) NULL;