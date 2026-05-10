import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // Pass through HttpExceptions (BadRequest, NotFound, etc.)
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            response.status(status).json(
                typeof body === 'string' ? { statusCode: status, message: body } : body,
            );
            return;
        }

        if (exception instanceof Error) {
            const msg = exception.message;

            // Prisma unique constraint → wallet já existe
            if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
                response.status(HttpStatus.CONFLICT).json({
                    statusCode: HttpStatus.CONFLICT,
                    error: 'Conflict',
                    message: 'Carteira já existe para este usuário',
                });
                return;
            }

            if (msg.includes('wallet not found')) {
                response.status(HttpStatus.NOT_FOUND).json({
                    statusCode: HttpStatus.NOT_FOUND,
                    error: 'Not Found',
                    message: 'Carteira não encontrada',
                });
                return;
            }

            if (msg.includes('insufficient funds')) {
                response.status(HttpStatus.PAYMENT_REQUIRED).json({
                    statusCode: HttpStatus.PAYMENT_REQUIRED,
                    error: 'Payment Required',
                    message: 'Saldo insuficiente',
                });
                return;
            }

            this.logger.error(`Unhandled error: ${msg}`, exception.stack);
        } else {
            this.logger.error('Unhandled non-Error exception', String(exception));
        }

        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'Internal Server Error',
            message: 'Ocorreu um erro inesperado. Tente novamente.',
        });
    }
}
