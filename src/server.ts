import { checkAndDeleteExpiredFiles } from './lib/verification';

console.log('[SERVER] Expired files monitoring started');

const CHECK_INTERVAL = 1000;

const monitor = setInterval(async () => {
    try {
        await checkAndDeleteExpiredFiles();
    } catch (error) {
        console.error('[SERVER] Error checking expired files:', error);
    }
}, CHECK_INTERVAL);

const shutdown = () => {
    console.log('\n[SERVER] Stopping monitoring...');
    clearInterval(monitor);
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);