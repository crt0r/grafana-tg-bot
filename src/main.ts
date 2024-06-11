import { writePid } from './pid.js';
import { BotConfig, loadConfig } from './config.js';
import { AlertBot } from './bot.js';
import { Cache } from './cache.js';
import { WebhookServer } from './webhook.js';

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
        const oldCache = cache;
        const oldBot = bot;
        const oldWebHook = webHook;

        cache = new Cache(config);
        bot = new AlertBot(config, cache);
        webHook = new WebhookServer(config, cache);

        oldWebHook.close();
        await oldBot.stop();
        await oldCache.quit();

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
        await bot.stop();
        await cache.quit();
    }),
);

await writePid();
webHook.listen();
await bot.start();
