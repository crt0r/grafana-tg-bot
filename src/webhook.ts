import { Cache } from './cache.js';
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
              endsAt: Date | null;
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
                endsAt: Joi.date().required(),
            }).unknown(true),
        )
        .required(),
}).unknown(true);

export class WebhookServer extends Server {
    private readonly config;

    constructor(config: BotConfig, cache: Cache) {
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
            // Why don't they just use `null` 🥲?
            const grafanaUnresolvedDate = new Date('0001-01-01T00:00:00Z');
            let requestBody: any;
            let validatedAlerts: Alerts;

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
                    validatedAlerts = (await alertSchema.validateAsync(requestBody)) as Alerts;
                } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: `Invalid JSON schema. ${e.message}.` }));
                    logger.error({
                        facility,
                        message: `client <${client.address}> json doesn't satisfy schema. ${e.message}.`,
                    });
                    return;
                }

                // If the endsAt date is unresolved, use a more sane value — `null` — instead of an obscure date.
                // Learn more about this field default value in the Grafana documentation:
                // https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/#alert
                validatedAlerts.alerts.forEach(alert => {
                    if (alert.endsAt.getTime() == grafanaUnresolvedDate.getTime()) {
                        alert.endsAt = null;
                    }
                });

                const pushed = await cache.queuePush(validatedAlerts);

                if (!pushed) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ message: 'could not add alerts to queue.' }));
                    logger.error(`dropped request for client <${client.address}> due to cache error.`);
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
