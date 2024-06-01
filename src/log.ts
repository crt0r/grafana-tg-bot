import { pino } from 'pino';

export const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-logfmt',
        options: {
            includeLevelLabel: true,
            levelLabelKey: 'level',
            timeKey: 'timestamp',
            convertToSnakeCase: true,
        },
    },
});
