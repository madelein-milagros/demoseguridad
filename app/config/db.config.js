import dotenv from "dotenv";
dotenv.config();

export default {
  HOST: process.env.DB_HOST,
  PORT: process.env.DB_PORT || 3306,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB: process.env.DB_NAME,
  dialect: "mysql"
};