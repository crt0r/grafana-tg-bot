import { logger } from './log.js';
import { BotConfig } from './config.js';
import { createClient } from '@redis/client';

const facility = 'cache';

export class Cache {
    private readonly subscribersKey = 'alert_subscribers';
    private readonly client;

    constructor(botConfig: BotConfig) {
        this.client = createClient({
            url: botConfig.cache.server.url,
        });

        this.client
            .on('error', err => logger.error({ facility, message: err.message }))
            .on('connect', _ => logger.info({ facility, message: 'connecting to cache' }))
            .on('ready', _ => logger.info({ facility, message: 'cache is ready' }))
            .on('end', _ => logger.info({ facility, message: 'disconnecting from cache' }));
    }

    async connect() {
        await this.client.connect();
    }

    async quit() {
        // Prevent crash on stop when cache is not available
        try {
            return await this.client.quit();
        } catch (_) {}
    }

    async addSubscriberChat(chatId: number) {
        return await this.client.SADD(this.subscribersKey, chatId.toString());
    }

    async delSubscriberChat(chatId: number) {
        return await this.client.SREM(this.subscribersKey, chatId.toString());
    }

    async getSubscriberChats(): Promise<number[]> {
        const subscribersStr = await this.client.SMEMBERS(this.subscribersKey);
        return subscribersStr.map(subscriber => Number.parseInt(subscriber));
    }

    async isChatSubscribedToAlerts(chatId: number) {
        return await this.client.SISMEMBER(this.subscribersKey, chatId.toString());
    }
}
