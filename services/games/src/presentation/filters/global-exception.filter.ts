import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** Maps known domain error messages to HTTP status + pt-BR description. */
const DOMAIN_ERRORS: Record<string, { status: number; message: string }> = {
    // ── Bet placement ──────────────────────────────────────────────────────────
    'round not in betting phase':
        { status: HttpStatus.CONFLICT, message: 'Apostas encerradas — aguarde a próxima rodada' },
    'already bet in this round':
        { status: HttpStatus.CONFLICT, message: 'Você já tem uma aposta nesta rodada' },
    'duplicate request':
        { status: HttpStatus.CONFLICT, message: 'Requisição duplicada — a aposta já foi registrada' },

    // ── Cashout ────────────────────────────────────────────────────────────────
    'round is not running':
        { status: HttpStatus.CONFLICT, message: 'A rodada não está em andamento' },
    'no active bet for user in this round':
        { status: HttpStatus.CONFLICT, message: 'Nenhuma aposta ativa nesta rodada' },
    'already cashed out':
        { status: HttpStatus.CONFLICT, message: 'Cashout já realizado nesta rodada' },
    'duplicate cashout request':
        { status: HttpStatus.CONFLICT, message: 'Requisição de cashout duplicada' },
    'wallet debit not yet confirmed':
        { status: HttpStatus.CONFLICT, message: 'Aposta ainda sendo processada pelo servidor — tente em instantes' },

    // ── Round / Bet lookup ─────────────────────────────────────────────────────
    'bet not found':
        { status: HttpStatus.NOT_FOUND, message: 'Aposta não encontrada' },
    'round not found':
        { status: HttpStatus.NOT_FOUND, message: 'Rodada não encontrada' },

    // ── Wallet ─────────────────────────────────────────────────────────────────
    'insufficient funds':
        { status: HttpStatus.PAYMENT_REQUIRED, message: 'Saldo insuficiente' },
    'wallet not found':
        { status: HttpStatus.NOT_FOUND, message: 'Carteira não encontrada' },
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // Pass HttpExceptions (BadRequestException, etc.) through unchanged.
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            response.status(status).json(
                typeof body === 'string' ? { statusCode: status, message: body } : body,
            );
            return;
        }

        if (exception instanceof Error) {
            const msg = exception.message.toLowerCase();

            // Find the first matching domain error by substring check.
            for (const [key, mapped] of Object.entries(DOMAIN_ERRORS)) {
                if (msg.includes(key.toLowerCase())) {
                    response.status(mapped.status).json({
                        statusCode: mapped.status,
                        error: HttpStatus[mapped.status],
                        message: mapped.message,
                    });
                    return;
                }
            }

            // Unknown domain error — log it, return generic 500.
            this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
            response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                error: 'Internal Server Error',
                message: 'Ocorreu um erro inesperado. Tente novamente.',
            });
            return;
        }

        // Non-Error throwables (strings, objects, etc.)
        this.logger.error('Unhandled non-Error exception', String(exception));
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'Internal Server Error',
            message: 'Ocorreu um erro inesperado. Tente novamente.',
        });
    }
}
