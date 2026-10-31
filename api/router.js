// The single Vercel serverless function. vercel.json rewrites /api/v1/<path> here with
// ?__route=<path>, which keeps the project under the Hobby plan's function limit.
import { handleNode } from './_lib/runtime.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(url.searchParams.entries());
  const path = query.__route || url.pathname.replace(/^\/api\/(v1\/)?(router\/?)?/, '');
  delete query.__route;
  return handleNode(req, res, path, query);
}
