import { BotConfig, loadConfig } from './config.js';
import { AlertBot } from './bot.js';
import { Cache } from './cache.js';
import { WebhookServer } from './webhook.js';

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldBot = bot;
        const oldCache = cache;
        const oldWebHook = webHook;

        cache = new Cache(config);
        bot = new AlertBot(config, cache);
        webHook = new WebhookServer(config);

        oldWebHook.close();
        await oldBot.stop();
        await oldCache.quit();

        await cache.connect();
        bot.start();
        webHook.listen();
    }
}

let config = (await loadConfig(true)) as BotConfig;
let cache = new Cache(config);
let bot = new AlertBot(config, cache);
let webHook = new WebhookServer(config);

process.on('SIGHUP', reloadConfig);

['SIGINT', 'SIGTERM'].forEach(signal =>
    process.on(signal, async () => {
        webHook.close();
        await bot.stop();
        await cache.quit();
    }),
);

await cache.connect();
bot.start();
webHook.listen();
