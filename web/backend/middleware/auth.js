import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'artdou-web-secret-change-in-production';

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/** 从 Authorization: Bearer <token> 或 cookie 读取并校验，设置 req.role, req.myStudentId */
export function authMiddleware(req, res, next) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  // 可选：从 cookie 读取 token（需 app 使用 cookie-parser）
  // if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
  if (!token) {
    req.role = 'guest';
    req.myStudentId = null;
    return next();
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    req.role = 'guest';
    req.myStudentId = null;
    return next();
  }
  req.role = decoded.role || 'guest';
  req.myStudentId = decoded.myStudentId || null;
  next();
}
