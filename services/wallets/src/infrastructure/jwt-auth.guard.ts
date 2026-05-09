import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Lazily initialised JWKS key set — shared across all requests to avoid
 * re-fetching the keys on every incoming request.
 */
let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!remoteJwks) {
        const uri = process.env.KEYCLOAK_JWKS_URI
            ?? 'http://keycloak:8080/realms/crash-game/protocol/openid-connect/certs';
        remoteJwks = createRemoteJWKSet(new URL(uri));
    }
    return remoteJwks;
}

/**
 * Guard that validates a Bearer JWT issued by Keycloak.
 * Sets `req.user = { userId: sub, ...claims }` on success.
 * Issuer check is intentionally skipped because the `iss` claim contains
 * the public-facing URL (localhost:8080) while the JWKS is fetched from
 * the internal Docker address (keycloak:8080).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<Record<string, any>>();
        const authHeader: string | undefined = req.headers['authorization'];

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing Bearer token');
        }

        const token = authHeader.slice(7);

        try {
            const { payload } = await jwtVerify(token, getJwks());
            req['user'] = { userId: payload.sub as string, ...payload };
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        return true;
    }
}
