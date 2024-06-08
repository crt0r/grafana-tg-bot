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
        webHook = new WebhookServer(config, cache);

        oldWebHook.close();
        await oldCache.quit();
        await oldBot.stop();

        await cache.connect();
        webHook.listen();
        await bot.start();
    }
}

let config = (await loadConfig(true)) as BotConfig;
let cache = new Cache(config);
let bot = new AlertBot(config, cache);
let webHook = new WebhookServer(config, cache);

process.on('SIGHUP', reloadConfig);

['SIGINT', 'SIGTERM'].forEach(signal =>
    process.on(signal, async () => {
        webHook.close();
        await cache.quit();
        await bot.stop();
    }),
);

await cache.connect();
webHook.listen();
await bot.start();
