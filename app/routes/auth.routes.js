import { signup, signin, refreshToken } from "../controllers/auth.controller.js";
import { checkDuplicateUsernameOrEmail } from "../middleware/verifySignUp.js";

export default function (app) {
  app.post("/api/auth/signup", checkDuplicateUsernameOrEmail, signup);
  app.post("/api/auth/signin", signin);

  // MEJORA 1: Refresh Token
  app.post("/api/auth/refresh", refreshToken);
}