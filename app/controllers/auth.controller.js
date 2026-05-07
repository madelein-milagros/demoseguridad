import db from "../models/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const User = db.user;
const Role = db.role;
const RefreshToken = db.refreshToken;

const errorResponse = (res, status, message, details = null) => {
  return res.status(status).json({
    success: false,
    message,
    ...(details && { details })
  });
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * 🔹 SIGNUP (igual que antes)
 */
export const signup = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { username, email, password, roles } = req.body || {};

    if (!username || !email || !password) {
      await t.rollback();
      return errorResponse(res, 400, "Faltan campos requeridos: username, email, password");
    }
    if (username.length < 3) {
      await t.rollback();
      return errorResponse(res, 400, "El username debe tener al menos 3 caracteres");
    }
    if (!isValidEmail(email)) {
      await t.rollback();
      return errorResponse(res, 400, "Email inválido");
    }
    if (password.length < 6) {
      await t.rollback();
      return errorResponse(res, 400, "El password debe tener al menos 6 caracteres");
    }

    const exists = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [{ username }, { email }]
      },
      transaction: t
    });
    if (exists) {
      await t.rollback();
      return errorResponse(res, 400, "Username o email ya están en uso");
    }

    const rolesCount = await Role.count({ transaction: t });
    if (rolesCount === 0) {
      await t.rollback();
      return errorResponse(res, 500, "No existen roles en la base de datos.");
    }

    const user = await User.create(
      {
        username,
        email,
        password: bcrypt.hashSync(password, 10)
      },
      { transaction: t }
    );

    let rolesToAssign = [];
    if (Array.isArray(roles) && roles.length > 0) {
      const foundRoles = await Role.findAll({
        where: { name: roles },
        transaction: t
      });
      if (foundRoles.length !== roles.length) {
        await t.rollback();
        return errorResponse(res, 400, "Uno o más roles no existen");
      }
      rolesToAssign = foundRoles;
    } else {
      const defaultRole = await Role.findOne({
        where: { name: "user" },
        transaction: t
      });
      rolesToAssign = [defaultRole];
    }

    await user.setRoles(rolesToAssign, { transaction: t });
    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: rolesToAssign.map(r => r.name)
      }
    });
  } catch (error) {
    await t.rollback();
    return errorResponse(res, 500, "Error al registrar usuario", error.message);
  }
};

/**
 * 🔹 SIGNIN — Ahora también genera Refresh Token
 */
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return errorResponse(res, 400, "Email y password son requeridos");
    }

    const user = await User.findOne({
      where: { email },
      include: { model: Role, through: { attributes: [] } }
    });

    if (!user) {
      return errorResponse(res, 404, "Usuario no encontrado");
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return errorResponse(res, 401, "Password incorrecto");
    }

    // 🔹 Access Token (corta duración: 15 min)
    const accessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.JWT_EXPIRATION || 900) }
    );

    // 🔹 MEJORA 1: Refresh Token (24h) — se guarda en BD
    const refreshToken = await RefreshToken.createToken(user);

    const authorities = user.roles?.map(r => r.name) || [];

    return res.status(200).json({
      success: true,
      message: "Login exitoso",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: authorities,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Error en login", error.message);
  }
};

/**
 * 🔹 MEJORA 1: REFRESH TOKEN
 * Renueva el access token usando un refresh token válido
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: requestToken } = req.body;

    if (!requestToken) {
      return errorResponse(res, 403, "Refresh Token es requerido");
    }

    // Buscar el refresh token en BD
    const tokenRow = await RefreshToken.findOne({
      where: { token: requestToken }
    });

    if (!tokenRow) {
      return errorResponse(res, 403, "Refresh Token no encontrado en BD");
    }

    // Verificar si expiró
    if (RefreshToken.verifyExpiration(tokenRow)) {
      await tokenRow.destroy();
      return errorResponse(res, 403, "Refresh Token expirado. Inicie sesión nuevamente.");
    }

    // Verificar firma JWT
    let decoded;
    try {
      decoded = jwt.verify(requestToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return errorResponse(res, 403, "Refresh Token inválido");
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.JWT_EXPIRATION || 900) }
    );

    return res.status(200).json({
      success: true,
      message: "Access Token renovado",
      data: {
        accessToken: newAccessToken,
        refreshToken: requestToken
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Error al refrescar token", error.message);
  }
};