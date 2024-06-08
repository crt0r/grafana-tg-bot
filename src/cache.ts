import { logger } from './log.js';
import { BotConfig } from './config.js';
import { Alerts } from './webhook.js';
import { createClient } from '@redis/client'; // TODO migrate to ioredis since it has a much better (documented, even!) API

const facility = 'cache';

export class Cache {
    private readonly subscribersKey = 'alert_subscribers';
    private readonly messageQueueKey = 'alerts_queue';
    private readonly config;
    private readonly client;

    constructor(config: BotConfig) {
        this.config = config;

        this.client = createClient({
            url: this.config.cache.server.url,
        });

        this.client
            .on('error', err => logger.error({ facility, message: err.message }))
            .on('ready', _ => logger.info({ facility, message: 'cache is ready' }))
            .on('end', _ => logger.info({ facility, message: 'disconnected from cache' }));
    }

    get isReady() {
        return this.client.isReady;
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

    async queuePush(alerts: Alerts) {
        return await this.client.LPUSH(this.messageQueueKey, JSON.stringify(alerts));
    }

    async queuePop(): Promise<Alerts | null> {
        try {
            const response = await this.client.RPOP(this.messageQueueKey);

            if (response) {
                return JSON.parse(response);
            }
        } catch (e: any) {
            logger.error({ facility, message: e.message });
        }

        return null;
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
