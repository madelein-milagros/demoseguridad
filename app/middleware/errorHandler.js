// MEJORA 3: Middleware Global de Errores
// Captura cualquier error no controlado y devuelve respuesta estandarizada

export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR GLOBAL]:", err.stack);

  // Errores de validación de Sequelize
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Error de validación",
      details: err.errors.map(e => e.message)
    });
  }

  // Errores de unique constraint (campo duplicado)
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(400).json({
      success: false,
      message: "Registro duplicado",
      details: err.errors.map(e => e.message)
    });
  }

  // Errores de JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Token inválido"
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expirado"
    });
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
};

// Middleware para rutas no encontradas (404)
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
};