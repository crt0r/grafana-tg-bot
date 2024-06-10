import { logger } from './log.js';
import fs from 'node:fs/promises';
import process from 'node:process';
import toml from 'toml';
import Joi from 'joi';

const facility = 'config';

export type BotConfig = {
    webhook: {
        server: {
            host: string;
            port: number;
            endpoint: string;
        };
    };
    cache: {
        server: {
            host: string;
            port: number;
        };
    };
    bot: {
        acl: {
            allow_tg_uid: Array<number>;
        };
        options: {
            tg_token: string;
            alert_queue_poll_interval: number;
            send_alert_interval: number;
            send_alert_group_interval: number | 'default';
        };
    };
};

const defaultConfigPath = `${process.cwd()}/config/botconfig.toml`;
const botConfigEnv = process.env['BOTCONFIG'];
const configPath = botConfigEnv ? botConfigEnv : defaultConfigPath;

const configSchema = Joi.object({
    webhook: Joi.object({
        server: Joi.object({
            host: Joi.string(),
            port: Joi.number().integer().positive(),
            endpoint: Joi.string(),
        }),
    }),
    cache: Joi.object({
        server: Joi.object({
            host: Joi.string(),
            port: Joi.number(),
        }),
    }),
    bot: Joi.object({
        acl: Joi.object({
            allow_tg_uid: Joi.array().items(Joi.number().integer().positive()),
        }),
        options: Joi.object({
            tg_token: Joi.string(),
            alert_queue_poll_interval: Joi.number().positive(),
            send_alert_interval: Joi.number().positive(),
            send_alert_group_interval: Joi.alternatives(Joi.number().positive(), Joi.string().equal('default')),
        }),
    }),
});

export async function loadConfig(canBeFatal: boolean): Promise<BotConfig | null> {
    let fileContent: string;
    let botConfig: BotConfig | null = null;

    try {
        fileContent = await fs.readFile(configPath, { encoding: 'utf-8' });
        const tomlParsed = toml.parse(fileContent);
        botConfig = (await configSchema.validateAsync(tomlParsed)) as unknown as BotConfig;
        logger.info({ facility, message: 'loaded config' });
    } catch (e: any) {
        const errorMessage = { facility, message: e.message };
        if (canBeFatal) {
            logger.fatal(errorMessage);
            process.exit(1);
        } else {
            logger.error(errorMessage);
        }
    }

    if (botConfig?.bot.options.send_alert_group_interval == 'default') {
        botConfig.bot.options.send_alert_group_interval = botConfig.bot.options.send_alert_interval;
    }

    return botConfig;
}
