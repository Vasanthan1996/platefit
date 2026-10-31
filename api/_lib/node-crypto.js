// Password hashing (scrypt) and signed session tokens (HS256 JWT) for Node.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const pbkdf2 = promisify(crypto.pbkdf2);
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function createNodeCrypto(secret) {
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  const hmac = (data) => crypto.createHmac('sha256', secret).update(data).digest();
  const safeEqual = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };

  return {
    uuid: () => crypto.randomUUID(),
    randomToken: (bytes = 32) => crypto.randomBytes(bytes).toString('hex'),
    sha256: async (s) => crypto.createHash('sha256').update(String(s)).digest('hex'),
    safeEqual,

    async hashPassword(password) {
      const salt = crypto.randomBytes(16);
      const key = await scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
      return `scrypt$16384$${salt.toString('hex')}$${key.toString('hex')}`;
    },

    async verifyPassword(password, stored) {
      if (!stored || typeof stored !== 'string') return false;
      const parts = stored.split('$');
      try {
        if (parts[0] === 'scrypt' && parts.length === 4) {
          const key = await scrypt(String(password), Buffer.from(parts[2], 'hex'), 64, { N: Number(parts[1]), r: 8, p: 1 });
          return crypto.timingSafeEqual(key, Buffer.from(parts[3], 'hex'));
        }
        if (parts[0] === 'pbkdf2' && parts.length === 4) {
          const key = await pbkdf2(String(password), Buffer.from(parts[2], 'hex'), Number(parts[1]), 32, 'sha256');
          return crypto.timingSafeEqual(key, Buffer.from(parts[3], 'hex'));
        }
      } catch { return false; }
      return false;
    },

    async signToken(payload, ttlMs) {
      const now = Math.floor(Date.now() / 1000);
      const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + Math.floor(ttlMs / 1000) }));
      return `${head}.${body}.${b64url(hmac(`${head}.${body}`))}`;
    },

    async verifyToken(token) {
      const [head, body, sig] = String(token).split('.');
      if (!head || !body || !sig) return null;
      if (!safeEqual(sig, b64url(hmac(`${head}.${body}`)))) return null;
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    },
  };
}
