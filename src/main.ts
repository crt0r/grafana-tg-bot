import { logger } from './log.js';
import { BotConfig, loadConfig } from './config.js';
import { Bot } from 'grammy';

let config = (await loadConfig(true)) as BotConfig;
let bot = new Bot(config.bot.options.tg_token);

process.on('SIGHUP', reloadConfig);

process.on('SIGINT', async () => {
    await stopBot(bot);
});

process.on('SIGTERM', async () => {
    await stopBot(bot);
});

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldBot = bot;
        bot = new Bot(config.bot.options.tg_token);

        await stopBot(oldBot);
        attachBotCallbacks(bot);
        await startBot(bot);
    }
}

function isUserAllowed(userId: number): boolean {
    return config.bot.acl.allow_tg_uid.includes(userId);
}

function attachBotCallbacks(bot: Bot) {
    bot.command('start', async ctx => {
        const facility = '/start';
        const userId = ctx.chatId;
        let reply;

        if (isUserAllowed(userId)) {
            reply = await ctx.reply('hi');
            logger.info({ facility, message: `authenticated request by allowed user` });
        } else {
            reply = await ctx.reply('not allowed');
            logger.error({ facility, message: `unauthenticated request by disallowed user <${ctx.chatId}>` });
        }

        return reply;
    });

    bot.catch(ctx => {
        logger.error({ facility: 'grammy', message: ctx.error });
    });
}

async function startBot(bot: Bot) {
    logger.info({ facility: startBot.name, message: 'starting bot' });
    await bot.start();
}

async function stopBot(bot: Bot) {
    logger.info({ facility: stopBot.name, message: 'stopping bot' });
    await bot.stop();
}

attachBotCallbacks(bot);
await startBot(bot);
