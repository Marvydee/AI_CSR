import jwt from "jsonwebtoken";

export const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      maxAge: "2h",
    });
    req.user = decoded;
    next();
  } catch (error) {
    console.error("[Auth] JWT verification failed", error.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const authenticateSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "SuperAdmin access required" });
  }
  next();
};

export const authenticateBusinessAdmin = (req, res, next) => {
  if (req.user?.role !== "BUSINESS_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Business admin access required" });
  }
  next();
};
