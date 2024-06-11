import { getProjectRoot } from './common.js';
import { logger } from './log.js';
import { writeFile } from 'fs/promises';
import os from 'os';

const facility = 'pid';
const projectRoot = getProjectRoot();

export async function writePid() {
    try {
        await writeFile(`${projectRoot}/gtg-bot.pid`, `${process.pid}${os.EOL}`);
    } catch (e: any) {
        logger.error({ facility, message: e.message });
    }
}
