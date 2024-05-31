import { z } from 'zod';

const botConfigSchema = z.object({
    bot: z.object({
        acl: z.object({
            allow_tg_uid: z.array(z.number().int()),
        }),
        options: z.object({
            tg_token: z.string(),
        }),
    }),
});

export type BotConfig = z.infer<typeof botConfigSchema>;
