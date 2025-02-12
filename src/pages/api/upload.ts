import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import multiparty from 'multiparty';
import { db } from '@/lib/db';

const writeFile = promisify(fs.writeFile);
const unlinkFile = promisify(fs.unlink);
const FILE_STORAGE_PATH = path.join(process.cwd(), 'uploads');
const DEFAULT_EXPIRATION_DAYS = 7;
const MAX_EXPIRATION_DAYS = 30;
const MIN_EXPIRATION_MS = 10 * 60 * 1000;

export const config = {
  api: { bodyParser: false },
};

async function deleteFile(token: string) {
  const result = await db.query('SELECT name FROM archives WHERE token = $1', [token]);

  if (result.rows.length === 0) {
    throw new Error('File not found or already deleted');
  }

  const fileName = result.rows[0].name;
  const filePath = path.join(FILE_STORAGE_PATH, fileName);

  try {
    await unlinkFile(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && (error as { code?: string }).code !== 'ENOENT') throw error;
  }

  await db.query('DELETE FROM archives WHERE token = $1', [token]);
}

function parseExpiration(expirationStr: string | undefined, uploadDate: Date): { expiration: Date; alert?: string } {
  if (!expirationStr) {
    return { expiration: new Date(uploadDate.getTime() + DEFAULT_EXPIRATION_DAYS * 24 * 3600000) };
  }

  const match = expirationStr.match(/^(\d+)([mhd])$/);
  if (!match) {
    return { expiration: new Date(uploadDate.getTime() + DEFAULT_EXPIRATION_DAYS * 24 * 3600000) };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  let expirationTime = uploadDate.getTime();
  let alert;

  switch (unit) {
    case 'd':
      expirationTime += value * 24 * 3600000;
      break;
    case 'h':
      expirationTime += value * 3600000;
      break;
    case 'm':
      expirationTime += value * 60000;
      break;
  }

  if (expirationTime - uploadDate.getTime() < MIN_EXPIRATION_MS) {
    expirationTime = uploadDate.getTime() + MIN_EXPIRATION_MS;
    alert = 'Expiration time too short. Minimum is 10 minutes, so it has been adjusted.';
  } else if (expirationTime - uploadDate.getTime() > MAX_EXPIRATION_DAYS * 24 * 3600000) {
    expirationTime = uploadDate.getTime() + MAX_EXPIRATION_DAYS * 24 * 3600000;
    alert = 'Expiration time too long. Maximum is 30 days, so it has been adjusted.';
  }

  return { expiration: new Date(expirationTime), alert };
}

async function handleRequest(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      const params = new URLSearchParams(body);
      const deleteToken = params.get('delete');

      if (!deleteToken) {
        return res.status(400).json({ error: 'Missing delete token' });
      }

      try {
        await deleteFile(deleteToken);
        return res.status(200).json({ message: 'File deleted successfully' });
      } catch (error: unknown) {
        if (error instanceof Error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(400).json({ error: 'An unknown error occurred' });
      }
    });
    return;
  }

  const form = new multiparty.Form();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(400).json({ error: 'Error parsing form data' });
    }

    if (!files || !files.file || files.file.length === 0) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = files.file[0];
    const useSecret = fields.secret && fields.secret[0] === 'true';
    const fileName = useSecret ? `${uuidv4()}-${crypto.randomBytes(8).toString('hex')}` : uuidv4().slice(0, 8);
    const ext = path.extname(file.originalFilename || '');
    const filePath = path.join(FILE_STORAGE_PATH, fileName + ext);

    try {
      await writeFile(filePath, await fs.promises.readFile(file.path));
    } catch (error) {
      console.error('File write error:', error);
      return res.status(500).json({ error: 'Failed to save file' });
    }

    const upload = new Date();
    const { expiration, alert } = parseExpiration(fields.expires ? fields.expires[0] : undefined, upload);

    const deleteTokenGenerated = crypto.randomBytes(32).toString('hex');
    const base = `${req.headers.origin || `https://${req.headers.host}`}`;
    const fileUrl = `${base}/${path.basename(filePath)}`;

    try {
      await db.query(
        'INSERT INTO archives (name, upload, expiration, token) VALUES ($1, $2, $3, $4)',
        [path.basename(filePath), upload, expiration, deleteTokenGenerated]
      );
    } catch (error: unknown) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.setHeader('X-Token', deleteTokenGenerated);
    return res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl,
      upload: upload.toISOString(),
      expiresAt: expiration.toISOString(),
      deleteToken: deleteTokenGenerated,
      ...(alert ? { alert } : {})
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return await handleRequest(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
