import { logger } from './log.js';
import { BotConfig } from './config.js';
import { Alerts } from './webhook.js';
import { Redis, RedisOptions } from 'ioredis';

const facility = 'cache';

export class Cache extends Redis {
    private readonly subscribersKey = 'alert_subscribers';
    private readonly messageQueueKey = 'alerts_queue';
    private readonly botConfig;

    constructor(config: BotConfig) {
        super({ host: config.cache.server.host, port: config.cache.server.port });
        this.botConfig = config;

        this.on('error', err => logger.error({ facility, message: err.message }));
    }

    async queuePush(alerts: Alerts) {
        try {
            return await this.lpush(this.messageQueueKey, JSON.stringify(alerts));
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }

    async queuePop() {
        try {
            const response = await this.rpop(this.messageQueueKey);
            if (response) {
                return JSON.parse(response);
            }
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }

    async addSubscriberChat(chatId: number) {
        try {
            return await this.sadd(this.subscribersKey, chatId.toString());
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }

    async delSubscriberChat(chatId: number) {
        try {
            return await this.srem(this.subscribersKey, chatId.toString());
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }

    async getSubscriberChats(): Promise<number[] | null> {
        try {
            const subscribersStr = await this.smembers(this.subscribersKey);
            return subscribersStr.map(subscriber => Number.parseInt(subscriber));
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }

    async isChatSubscribedToAlerts(chatId: number) {
        try {
            return await this.sismember(this.subscribersKey, chatId.toString());
        } catch (e: any) {
            logger.error({ facility, message: e.message });
            return null;
        }
    }
}
