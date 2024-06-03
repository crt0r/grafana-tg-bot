import { logger } from './log.js';
import { BotConfig } from './config.js';
import { Cache } from './cache.js';
import { Bot, CommandContext, Context } from 'grammy';

type ChatType = 'group' | 'personal';

export async function getBotUsername(bot: Bot): Promise<string> {
    const facility = getBotUsername.name;
    let botUser;

    try {
        botUser = await bot.api.getMe();
        logger.info({ facility, message: `fetched bot username <${botUser.username}>` });
    } catch (e: any) {
        logger.fatal({ facility, message: e.message });
        process.exit(1);
    }

    return botUser.username;
}

export function attachBotMiddlewares(botUserName: string, config: BotConfig, bot: Bot, cache: Cache) {
    const group = (ctx: CommandContext<Context>) => determineChatType(ctx) == 'group';
    const personal = (ctx: CommandContext<Context>) => determineChatType(ctx) == 'personal';
    const authRequest = (command: string) => (ctx: CommandContext<Context>) =>
        authenticateRequest(config, ctx, command);

    bot.command(`start@${botUserName}`)
        .filter(group)
        .filter(authRequest(`start@${botUserName}`), subscribeChat(cache));
    bot.command(`stop@${botUserName}`)
        .filter(group)
        .filter(authRequest(`stop@${botUserName}`), unsubscribeChat(cache));

    bot.command('start').filter(personal).filter(authRequest('start'), subscribeChat(cache));
    bot.command('stop').filter(personal).filter(authRequest('stop'), unsubscribeChat(cache));
}

function subscribeChat(cache: Cache) {
    return async (ctx: CommandContext<Context>) => {
        const isAlreadySubscribed = await cache.isChatSubscribedToAlerts(ctx.chatId);

        if (!isAlreadySubscribed) {
            const reply = await ctx.reply('This chat is now subscribed to Grafana alerts.');
            await cache.addSubscriberChat(ctx.chatId);
            return reply;
        } else {
            return await ctx.reply('This chat is already subscribed to Grafana alerts.');
        }
    };
}

function unsubscribeChat(cache: Cache) {
    return async (ctx: CommandContext<Context>) => {
        const isAlreadySubscribed = await cache.isChatSubscribedToAlerts(ctx.chatId);

        if (isAlreadySubscribed) {
            const reply = await ctx.reply('This chat will no longer receive Grafana alerts.');
            await cache.delSubscriberChat(ctx.chatId);
            return reply;
        } else {
            return ctx.reply('This chat is not subscribed to Grafana alerts yet.');
        }
    };
}

function authenticateRequest(config: BotConfig, ctx: CommandContext<Context>, facility = 'filter'): boolean {
    const chatType: ChatType = determineChatType(ctx);
    const userId = ctx.chatId;
    const from = ctx.from;
    let isRequestAuthenticated = false;
    let allowedUser!: number;
    let disallowedUser!: number;

    switch (chatType) {
        case 'personal': {
            const userAllowed = isUserAllowed(config, userId);
            isRequestAuthenticated = userAllowed;

            if (!userAllowed) {
                disallowedUser = userId;
            } else {
                allowedUser = userId;
            }

            break;
        }
        case 'group': {
            if (from) {
                const userAllowed = isUserAllowed(config, from.id);
                isRequestAuthenticated = userAllowed;

                if (!userAllowed) {
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
            message: `authenticated request by allowed user <${allowedUser}> in chat <${ctx.chatId}>`,
        });
    } else {
        logger.error({
            facility,
            message: `unauthenticated request by disallowed user <${disallowedUser}> in chat <${ctx.chatId}>`,
        });
    }

    return isRequestAuthenticated;
}

function determineChatType(ctx: CommandContext<Context>): ChatType {
    return ctx.chatId > 0 ? 'personal' : 'group';
}

export async function startBot(bot: Bot, facility = startBot.name) {
    logger.info({ facility, message: 'starting bot' });
    await bot.start();
}

export async function stopBot(bot: Bot, facility = stopBot.name) {
    logger.info({ facility, message: 'stopping bot' });
    await bot.stop();
}

function isUserAllowed(config: BotConfig, userId: number): boolean {
    return config.bot.acl.allow_tg_uid.includes(userId);
}
