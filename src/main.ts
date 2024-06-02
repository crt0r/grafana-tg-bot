import { BotConfig, loadConfig } from './config.js';
import { getBotUsername, startBot, stopBot, attachBotCallbacks } from './bot.js';
import { Bot } from 'grammy';

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldBot = bot;
        bot = new Bot(config.bot.options.tg_token);

        await stopBot(oldBot, reloadConfig.name);
        attachBotCallbacks(botUserName, config, bot);
        await startBot(bot, reloadConfig.name);
    }
}

let config = (await loadConfig(true)) as BotConfig;
let bot = new Bot(config.bot.options.tg_token);
let botUserName = await getBotUsername(bot);

process.on('SIGHUP', reloadConfig);

['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, async () => await stopBot(bot)));

attachBotCallbacks(botUserName, config, bot);
await startBot(bot);
