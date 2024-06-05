import { AddressInfo } from 'node:net';
import { BotConfig } from './config.js';
import { logger } from './log.js';
import { Server } from 'node:http';

export class WebhookServer extends Server {
    private readonly facility = 'webhook';
    private config;

    constructor(config: BotConfig) {
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

            res.setHeader('Content-Type', 'application/json');

            if (method != 'POST') {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed.' }));
                logger.error({
                    facility: this.facility,
                    message: `client <${client.address}> send request using disallowed method <${method}>`,
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

            res.statusCode = 200;
            res.end(JSON.stringify({ message: 'OK.' }));
            logger.info({
                facility: this.facility,
                message: `client <${client.address}> requested endpoint <${requestUrl}>`,
            });
        });

        this.on('close', () => logger.info({ facility: this.facility, message: 'webhook server stopped' }));

        this.on('error', err => logger.error({ facility: this.facility, message: err.message }));
    }

    listen() {
        return super.listen({ host: this.config.webhook.server.host, port: this.config.webhook.server.port });
    }
}
