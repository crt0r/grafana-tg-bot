import { logger } from './log.js';
import { type BotConfig } from './config.js';
import { Bot } from 'grammy';

function isUserAllowed(config: BotConfig, userId: number): boolean {
    return config.bot.acl.allow_tg_uid.includes(userId);
}

export function attachBotCallbacks(config: BotConfig, bot: Bot) {
    bot.command('start', async ctx => {
        const facility = '/start';
        const userId = ctx.chatId;
        let reply;

        if (isUserAllowed(config, userId)) {
            reply = await ctx.reply('hi');
            logger.info({ facility, message: `authenticated request by allowed user` });
        } else {
            reply = await ctx.reply('not allowed');
            logger.error({ facility, message: `unauthenticated request by disallowed user <${ctx.chatId}>` });
        }

        return reply;
    });
}

export async function startBot(bot: Bot) {
    logger.info({ facility: startBot.name, message: 'starting bot' });
    await bot.start();
}

export async function stopBot(bot: Bot) {
    logger.info({ facility: stopBot.name, message: 'stopping bot' });
    await bot.stop();
}
