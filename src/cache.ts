import { logger } from './log.js';

import { createClient } from '@redis/client';
import { type BotConfig } from './config.js';

export class Cache {
    private facility = 'cache';
    private subscribersKey = 'alert_subscribers';
    private client;

    constructor(botConfig: BotConfig) {
        this.client = createClient({
            url: botConfig.cache.server.url,
        }).on('error', err => logger.error({ facility: this.facility, message: err.message }));
    }

    async connect(facility = this.facility) {
        logger.info({ facility, message: 'connecting to cache' });
        await this.client.connect();
    }

    async quit(facility = this.facility) {
        logger.info({ facility, message: 'disconnecting from cache' });
        return await this.client.quit();
    }

    async addSubscriberChat(chatId: number) {
        return await this.client.SADD(this.subscribersKey, chatId.toString());
    }

    async delSubscriberChat(chatId: number) {
        return await this.client.SREM(this.subscribersKey, chatId.toString());
    }

    async isChatSubscribedToAlerts(chatId: number) {
        return await this.client.SISMEMBER(this.subscribersKey, chatId.toString());
    }
}
