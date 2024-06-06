import { AlertBot } from './bot.js';
import { BotConfig } from './config.js';
import { logger } from './log.js';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';

export class WebhookServer extends Server {
    private readonly facility = 'webhook';
    private config;

    constructor(config: BotConfig, bot: AlertBot) {
        super();

        this.config = config;

        this.on('listening', () => {
            const { address, port } = this.address() as AddressInfo;

            logger.info({
                facility: this.facility,
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
                    facility: this.facility,
                    message: `client <${client.address}> sent request using disallowed method <${method}>`,
                });
                return;
            }

            if (requestUrl != this.config.webhook.server.endpoint) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Wrong endpoint.' }));
                logger.error({
                    facility: this.facility,
                    message: `client <${client.address}> sent request to wrong endpoint <${requestUrl}>`,
                });
                return;
            }

            req.on('data', (chunk: Buffer) => {
                requestBodyParts.push(chunk);
            });

            req.on('end', () => {
                try {
                    requestBody = JSON.parse(Buffer.concat(requestBodyParts).toString());
                } catch (e: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'valid json expected.' }));
                    logger.error({
                        facility: this.facility,
                        message: `client <${client.address}> failed to provide valid json`,
                    });
                    return;
                }

                bot.sendNotifications(requestBody);

                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'ok.' }));
                logger.info({
                    facility: this.facility,
                    message: `client <${client.address}> successfully accessed endpoint <${requestUrl}>`,
                });
            });
        });

        this.on('close', () => logger.info({ facility: this.facility, message: 'webhook server stopped' }));

        this.on('error', err => logger.error({ facility: this.facility, message: err.message }));
    }

    listen() {
        return super.listen({ host: this.config.webhook.server.host, port: this.config.webhook.server.port });
    }
}
