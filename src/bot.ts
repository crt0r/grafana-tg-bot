import { Alerts } from './webhook.js';
import { logger } from './log.js';
import { BotConfig } from './config.js';
import { Cache } from './cache.js';
import { Bot, CommandContext, Context, GrammyError, HttpError } from 'grammy';

type ChatType = 'group' | 'personal';
const facility = 'bot';

export class AlertBot extends Bot {
    private readonly config;
    private readonly cache;
    private userName: string | null = null;

    constructor(config: BotConfig, cache: Cache) {
        super(config.bot.options.tg_token);

        this.config = config;
        this.cache = cache;
    }

    async start() {
        logger.info({ facility, message: 'starting bot' });

        this.userName = await this.getUsername();
        this.attachMiddlewares();

        // TODO implement retry or fail.
        try {
            await super.start();
        } catch (err: any) {
            switch (err.constructor) {
                case GrammyError: {
                    logger.fatal({
                        facility,
                        message: `encountered an error from telegram api. ${(err as GrammyError).description}.`,
                    });
                    break;
                }

                case HttpError: {
                    logger.fatal({
                        facility,
                        message: `encountered a network error while contacting telegram api. ${(err as HttpError).message}.`,
                    });
                    break;
                }

                default: {
                    logger.fatal({
                        facility,
                        message: `encnountered an error of unknown type. ${(err as Error).message}.`,
                    });
                    break;
                }
            }

            process.exit(1);
        }
    }

    async stop() {
        await super.stop();
        logger.info({ facility, message: 'bot stopped' });
    }

    async sendNotifications(alerts: Alerts) {
        const subscribers = await this.cache.getSubscriberChats();
        const alertMessageBodys = alerts.alerts.map(alert => {
            const title = `${alert.labels.alertname.trim()}`;
            const status = `<b>[${alert.status.trim().toUpperCase()}]</b>: ${title}\n\n`;
            const startsAt = `<b>[FIRED AT]</b>: ${alert.startsAt}\n\n`;
            const endsAt = alert.endsAt ? `<b>[RESOLVED AT]</b>: ${alert.endsAt}\n\n` : '';
            const annotationsItems = Object.entries(alert.annotations)
                .sort()
                .map(
                    annotation =>
                        `<b>[${annotation[0].trim().toUpperCase()}]</b>\n${(annotation[1] as string).trim()}\n`,
                )
                .join('\n');
            const message = [status, startsAt, endsAt, annotationsItems].join('');

            return message;
        });

        subscribers.forEach(subscriber =>
            alertMessageBodys.forEach(messageBody =>
                this.api.sendMessage(subscriber, messageBody, {
                    parse_mode: 'HTML',
                }),
            ),
        );
    }

    private async getUsername(): Promise<string> {
        let botUser;

        try {
            botUser = await this.api.getMe();
            logger.info({ facility, message: `fetched bot username <${botUser.username}>` });
        } catch (e: any) {
            logger.fatal({ facility, message: `could not fetch bot username. ${e.message}.` });
            process.exit(1);
        }

        return botUser.username;
    }

    private attachMiddlewares() {
        const filters = {
            groupChat: (ctx: CommandContext<Context>) => this.determineChatType(ctx) == 'group',
            personalChat: (ctx: CommandContext<Context>) => this.determineChatType(ctx) == 'personal',
            authRequest: (ctx: CommandContext<Context>) => this.authenticateRequest(ctx),
        };

        this.command(`start@${this.userName}`)
            .filter(filters.groupChat)
            .filter(filters.authRequest, this.subscribeChat(true));
        this.command(`stop@${this.userName}`)
            .filter(filters.groupChat)
            .filter(filters.authRequest, this.unsubscribeChat(true));

        this.command('start').filter(filters.personalChat).filter(filters.authRequest, this.subscribeChat());
        this.command('stop').filter(filters.personalChat).filter(filters.authRequest, this.unsubscribeChat());
    }

    private subscribeChat(replyTo = false) {
        return async (ctx: CommandContext<Context>) => {
            const isAlreadySubscribed = await this.cache.isChatSubscribedToAlerts(ctx.chatId);

            if (!isAlreadySubscribed) {
                const reply = await ctx.reply(
                    'This chat is now subscribed to Grafana alerts.',
                    this.withReplyTo(ctx, replyTo),
                );
                await this.cache.addSubscriberChat(ctx.chatId);
                return reply;
            } else {
                return await ctx.reply(
                    'This chat is already subscribed to Grafana alerts.',
                    this.withReplyTo(ctx, replyTo),
                );
            }
        };
    }

    private unsubscribeChat(replyTo = false) {
        return async (ctx: CommandContext<Context>) => {
            const isAlreadySubscribed = await this.cache.isChatSubscribedToAlerts(ctx.chatId);

            if (isAlreadySubscribed) {
                const reply = await ctx.reply(
                    'This chat will no longer receive Grafana alerts.',
                    this.withReplyTo(ctx, replyTo),
                );
                await this.cache.delSubscriberChat(ctx.chatId);
                return reply;
            } else {
                return ctx.reply('This chat is not subscribed to Grafana alerts yet.', this.withReplyTo(ctx, replyTo));
            }
        };
    }

    private withReplyTo(ctx: CommandContext<Context>, replyTo: boolean) {
        return replyTo ? { reply_parameters: { message_id: ctx.msg.message_id } } : {};
    }

    private authenticateRequest(ctx: CommandContext<Context>): boolean {
        const chatType: ChatType = this.determineChatType(ctx);
        const userId = ctx.chatId;
        const from = ctx.from;
        let isRequestAuthenticated = false;
        let allowedUser: number | null = null;
        let disallowedUser: number | null = null;

        switch (chatType) {
            case 'personal': {
                isRequestAuthenticated = this.isUserAllowed(userId);

                if (!isRequestAuthenticated) {
                    disallowedUser = userId;
                } else {
                    allowedUser = userId;
                }

                break;
            }

            case 'group': {
                if (from) {
                    isRequestAuthenticated = this.isUserAllowed(from.id);

                    if (!isRequestAuthenticated) {
                        disallowedUser = from.id;
                    } else {
                        allowedUser = from.id;
                    }
                }

                break;
            }
        }

        if (isRequestAuthenticated) {
            logger.info({
                facility,
                message: `authenticated request <${ctx.message?.text}> by allowed user <${allowedUser}> in chat <${ctx.chatId}>`,
            });
        } else {
            logger.error({
                facility,
                message: `unauthenticated request <${ctx.message?.text}> by disallowed user <${disallowedUser}> in chat <${ctx.chatId}>`,
            });
        }

        return isRequestAuthenticated;
    }

    private determineChatType(ctx: CommandContext<Context>): ChatType {
        return ctx.chatId > 0 ? 'personal' : 'group';
    }

    private isUserAllowed(userId: number): boolean {
        return this.config.bot.acl.allow_tg_uid.includes(userId);
    }
}
