import { logger } from './log.js';
import { type BotConfig } from './config.js';
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

export function attachBotCallbacks(botUserName: string, config: BotConfig, bot: Bot) {
    bot.command(`start@${botUserName}`)
        .filter(ctx => determineChatType(ctx) == 'group')
        .filter(
            ctx => authenticateRequest(config, ctx, `start@${botUserName}`),
            async ctx => await ctx.reply('hi'),
        );

    bot.command('start')
        .filter(ctx => determineChatType(ctx) == 'personal')
        .filter(
            ctx => authenticateRequest(config, ctx, 'start'),
            async ctx => await ctx.reply('hi'),
        );
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
