import helmet from "helmet";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./models/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js"; // MEJORA 3

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Detectar entorno
const isDev = process.env.NODE_ENV === "development";

// Sincronización inteligente
await db.sequelize.sync({
  force: isDev
});

// Inicializar roles (solo si no existen)
const count = await db.role.count();
if (count === 0) {
  await db.role.bulkCreate([
    { id: 1, name: "user" },
    { id: 2, name: "moderator" },
    { id: 3, name: "admin" }
  ]);
  console.log("Roles creados");
}

// Rutas
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";

authRoutes(app);
userRoutes(app);

// MEJORA 3: Middleware global de errores (DEBE IR AL FINAL, después de las rutas)
app.use(notFoundHandler); // 404 para rutas no encontradas
app.use(errorHandler);    // Captura todos los errores

// Puerto desde .env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV}`);
});