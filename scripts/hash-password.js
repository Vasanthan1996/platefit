// Prints a scrypt hash for ADMIN_PASSWORD_HASH so the plain password never sits in your env.
//   npm run hash-password -- "your-strong-password"
import { createNodeCrypto } from '../api/_lib/node-crypto.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your-strong-password"');
  process.exit(1);
}
const c = createNodeCrypto('x'.repeat(32));
console.log(await c.hashPassword(password));
console.log('\nPaste this as ADMIN_PASSWORD_HASH in Vercel and remove ADMIN_PASSWORD.');
