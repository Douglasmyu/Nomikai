import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Supabase signs access tokens with ES256; the JWKS is cached and refreshed by
// jose, so verification stays local after the first fetch.
const jwks = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

type AuthedRequest = Request & { userId?: string; userEmail?: string };

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      });
      if (!payload.sub) throw new Error('No subject');
      req.userId = payload.sub;
      req.userEmail =
        typeof payload.email === 'string' ? payload.email : undefined;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}

export const UserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().userId!,
);

export const UserEmail = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().userEmail ?? null,
);
