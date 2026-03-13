const jwt = require("jsonwebtoken");

const TOKEN_TTL = process.env.ADMIN_TOKEN_EXPIRE || "15d";

const signAdminToken = (admin) =>
  jwt.sign(
    {
      sub: admin._id,
      username: admin.username,
      type: "admin_auth",
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

module.exports = { signAdminToken };
