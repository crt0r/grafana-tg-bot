import { pino } from 'pino';
import dayjs from 'dayjs';

export const logger = pino({
    timestamp: () => `,"timestamp": "${dayjs(new Date(Date.now())).format('YYYY-MM-DDTHH:mm:ss.SSSZZ')}"`,
    level: 'info',
    formatters: {
        level: (label, _) => ({ level: label }),
    },
    transport: {
        target: 'pino-logfmt',
    },
});
