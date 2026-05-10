import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated user object (populated by JwtAuthGuard) from the request. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): { userId: string } => {
        const req = ctx.switchToHttp().getRequest<Record<string, any>>();
        return req['user'];
    },
);
