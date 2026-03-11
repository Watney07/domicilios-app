const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");

// POST /api/auth/register
router.post("/register", authController.register);
// POST /api/auth/login
router.post("/login", authController.login);
// POST /api/auth/verify-2fa
router.post("/verify-2fa", authController.verify2fa);

module.exports = router;
