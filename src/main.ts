import { BotConfig, loadConfig } from './config.js';
import { getBotUsername, startBot, stopBot, attachBotMiddlewares } from './bot.js';
import { Cache } from './cache.js';
import { WebhookServer } from './webhook.js';
import { Bot } from 'grammy';

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldBot = bot;
        const oldCache = cache;
        const oldWebHook = webHook;

        bot = new Bot(config.bot.options.tg_token);
        cache = new Cache(config);
        webHook = new WebhookServer(config);

        oldWebHook.close();
        await stopBot(oldBot);
        await oldCache.quit();

        attachBotMiddlewares(botUserName, config, bot, cache);
        await cache.connect();
        startBot(bot);
        webHook.listen();
    }
}

let config = (await loadConfig(true)) as BotConfig;
let cache = new Cache(config);
let bot = new Bot(config.bot.options.tg_token);
let webHook = new WebhookServer(config);
let botUserName = await getBotUsername(bot);

process.on('SIGHUP', reloadConfig);

['SIGINT', 'SIGTERM'].forEach(signal =>
    process.on(signal, async () => {
        webHook.close();
        await stopBot(bot);
        await cache.quit();
    }),
);

attachBotMiddlewares(botUserName, config, bot, cache);
await cache.connect();
startBot(bot);
webHook.listen();
