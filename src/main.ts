import { BotConfig, loadConfig } from './config.js';

let config = (await loadConfig(true)) as BotConfig;
process.on('SIGHUP', reloadConfig);

async function reloadConfig() {
    const newConfig = await loadConfig(false);

    if (newConfig) {
        config = newConfig;
    }
}

while (true) {
    await new Promise(resolve => {
        console.log(config.bot);
        setTimeout(resolve, 5000);
    });
}
