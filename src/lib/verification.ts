import { db } from './db';
import fs from 'fs';
import path from 'path';

const PUBLIC_FOLDER = path.join(process.cwd(), 'uploads');

export const checkAndDeleteExpiredFiles = async () => {
    try {
        const result = await db.query('SELECT id, name FROM archives WHERE expiration <= NOW()');

        if (result.rows.length === 0) {
            return;
        }

        for (const row of result.rows) {
            const filePath = path.join(PUBLIC_FOLDER, row.name);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[VERIFICATION] Deleted file: ${row.name}`);
            } else {
                console.log(`[VERIFICATION] File not found: ${row.name}`);
            }

            await db.query('DELETE FROM archives WHERE id = $1', [row.id]);
            console.log(`[VERIFICATION] Record removed from database: ${row.name}`);
        }
    } catch (error) {
        console.error('[VERIFICATION] Error verifying files:', error);
    }
};
