import { logger } from './log.js';
import fs from 'node:fs/promises';
import process from 'node:process';
import toml from 'toml';
import Joi from 'joi';

const facility = 'config';

export type BotConfig = {
    cache: {
        server: {
            url: string;
        };
    };
    bot: {
        acl: {
            allow_tg_uid: Array<number>;
        };
        options: {
            tg_token: string;
        };
    };
};

const defaultConfigPath = `${process.cwd()}/config/botconfig.toml`;
const botConfigEnv = process.env['BOTCONFIG'];
let configPath = botConfigEnv ? botConfigEnv : defaultConfigPath;

const configSchema = Joi.object({
    cache: Joi.object({
        server: Joi.object({
            url: Joi.string(),
        }),
    }),
    bot: Joi.object({
        acl: Joi.object({
            allow_tg_uid: Joi.array().items(Joi.number().integer().positive()),
        }),
        options: Joi.object({
            tg_token: Joi.string(),
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

    return botConfig;
}
