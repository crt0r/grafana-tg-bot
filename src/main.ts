import { BotConfig, loadConfig } from './config.js';
import { Bot } from 'grammy';
import { startBot, stopBot, attachBotCallbacks } from './bot.js';

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldBot = bot;
        bot = new Bot(config.bot.options.tg_token);

        await stopBot(oldBot);
        attachBotCallbacks(config, bot);
        await startBot(bot);
    }
}

let config = (await loadConfig(true)) as BotConfig;
let bot = new Bot(config.bot.options.tg_token);

process.on('SIGHUP', reloadConfig);

['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, async () => await stopBot(bot)));

attachBotCallbacks(config, bot);
await startBot(bot);
