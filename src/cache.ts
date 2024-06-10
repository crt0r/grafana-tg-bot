import { logger } from './log.js';
import { BotConfig } from './config.js';
import { Alerts } from './webhook.js';
import { Redis } from 'ioredis';

const facility = 'cache';

export class Cache extends Redis {
    private readonly subscribersKey = 'alert_subscribers';
    private readonly messageQueueKey = 'alerts_queue';
    private readonly botConfig;

    constructor(config: BotConfig) {
        super({ lazyConnect: true });

        this.botConfig = config;
        this.options.host = this.botConfig.cache.server.host;
        this.options.port = this.botConfig.cache.server.port;

        if (this.botConfig.cache.auth.enabled) {
            this.options.username = this.botConfig.cache.auth.user;
            this.options.password = this.botConfig.cache.auth.password;
        }

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
