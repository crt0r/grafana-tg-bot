import { AlertBot } from './bot.js';
import { BotConfig } from './config.js';
import { logger } from './log.js';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import Joi from 'joi';

export type Alerts = {
    alerts: [
        | {
              status: string;
              labels: Record<string, string>;
              annotations: Record<string, string>;
              startsAt: Date;
              endsAt: Date | undefined;
          }
        | Record<string, any>,
    ];
};

const facility = 'webhook';

const alertSchema = Joi.object({
    alerts: Joi.array()
        .items(
            Joi.object({
                status: Joi.string().required(),
                labels: Joi.object().unknown(true).required(),
                annotations: Joi.object().unknown(true).required(),
                startsAt: Joi.date().required(),
                endsAt: Joi.date().optional().required(),
            }).unknown(true),
        )
        .required(),
}).unknown(true);

export class WebhookServer extends Server {
    private config;

    constructor(config: BotConfig, bot: AlertBot) {
        super();

        this.config = config;

        this.on('listening', () => {
            const { address, port } = this.address() as AddressInfo;

            logger.info({
                facility,
                message: `webhook server listening on ${address}:${port}`,
            });
        });

        this.on('request', (req, res) => {
            const requestUrl = req.url;
            const client = req.socket.address() as AddressInfo;
            const method = req.method;
            const requestBodyParts: Buffer[] = [];
            let requestBody: any;

            res.setHeader('Content-Type', 'application/json');

            if (method != 'POST') {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed.' }));
                logger.error({
                    facility,
                    message: `client <${client.address}> sent request using disallowed method <${method}>`,
                });
                return;
            }

            if (requestUrl != this.config.webhook.server.endpoint) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Wrong endpoint.' }));
                logger.error({
                    facility,
                    message: `client <${client.address}> sent request to wrong endpoint <${requestUrl}>`,
                });
                return;
            }

            req.on('data', (chunk: Buffer) => {
                requestBodyParts.push(chunk);
            });

            req.on('end', async () => {
                try {
                    requestBody = JSON.parse(Buffer.concat(requestBodyParts).toString());
                } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Valid JSON expected.' }));
                    logger.error({
                        facility,
                        message: `client <${client.address}> failed to provide valid json`,
                    });
                    return;
                }

                try {
                    const validatedAlerts = await alertSchema.validateAsync(requestBody);
                    bot.sendNotifications(validatedAlerts);
                } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: `Invalid JSON schema. ${e.message}.` }));
                    logger.error({ facility, message: e.message });
                    return;
                }

                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'ok.' }));
                logger.info({
                    facility,
                    message: `client <${client.address}> successfully accessed endpoint <${requestUrl}>`,
                });
            });
        });

        this.on('close', () => logger.info({ facility, message: 'webhook server stopped' }));

        this.on('error', err => logger.error({ facility, message: err.message }));
    }

    listen() {
        return super.listen({ host: this.config.webhook.server.host, port: this.config.webhook.server.port });
    }
}
