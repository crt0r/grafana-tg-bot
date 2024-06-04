import { logger } from './log.js';

import { createClient } from '@redis/client';
import { type BotConfig } from './config.js';

export class Cache {
    private facility = 'cache';
    private subscribersKey = 'alert_subscribers';
    private client;

    constructor(botConfig: BotConfig) {
        const facility = this.facility;

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
