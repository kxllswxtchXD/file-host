import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { file } = req.query;

  if (!file || !Array.isArray(file)) {
    return res.status(400).json({ error: 'not found' });
  }

  const filePath = path.join(process.cwd(), 'uploads', ...file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'not found' });
  }

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}
