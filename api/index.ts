import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/index.serverless.fixed.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
