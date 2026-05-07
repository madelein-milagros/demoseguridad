import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export default (sequelize, Sequelize) => {
  const RefreshToken = sequelize.define("refreshTokens", {
    token: {
      type: Sequelize.STRING(500),
      allowNull: false
    },
    expiryDate: {
      type: Sequelize.DATE,
      allowNull: false
    }
  });

  // Crear un nuevo refresh token y guardarlo en BD
  RefreshToken.createToken = async function (user) {
    const expiredAt = new Date();
    expiredAt.setSeconds(
      expiredAt.getSeconds() + parseInt(process.env.JWT_REFRESH_EXPIRATION || 86400)
    );

    // Generar JWT como refresh token
    const tokenValue = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: parseInt(process.env.JWT_REFRESH_EXPIRATION || 86400) }
    );

    // Eliminar refresh tokens previos del usuario
    await RefreshToken.destroy({ where: { userId: user.id } });

    const refreshToken = await RefreshToken.create({
      token: tokenValue,
      userId: user.id,
      expiryDate: expiredAt.getTime()
    });

    return refreshToken.token;
  };

  // Verificar si un refresh token expiró
  RefreshToken.verifyExpiration = (token) => {
    return token.expiryDate.getTime() < new Date().getTime();
  };

  return RefreshToken;
};