import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Postgres constraint violations are the validation layer here — the schema
// already enforces the username pattern, the note length, the one-drink-source
// rule, and the friendship pair uniqueness. The web app switches on `code`
// (23505 → "username taken" / "already friends"), so it is passed through.
const STATUS: Record<string, number> = {
  '23505': 409, // unique_violation
  '23514': 400, // check_violation
  '23503': 400, // foreign_key_violation
  '23502': 400, // not_null_violation
  '22P02': 400, // invalid_text_representation (bad uuid)
};

/** Drizzle wraps driver errors in DrizzleQueryError, so the code is on .cause. */
function pgCode(error: unknown): string | undefined {
  for (let e = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && code in STATUS) return code;
  }
  return undefined;
}

@Catch()
export class PgErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(PgErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { message: body } : body);
      return;
    }

    const code = pgCode(exception);
    if (code) {
      res.status(STATUS[code]).json({
        statusCode: STATUS[code],
        code,
        message: (exception as { message?: string }).message,
      });
      return;
    }

    this.logger.error(exception);
    res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
