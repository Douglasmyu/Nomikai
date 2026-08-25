import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { AuthGuard } from './auth.guard';
import { DB, type Db } from './db';
import { drinks } from './db/schema';

@Controller('drinks')
@UseGuards(AuthGuard)
export class DrinksController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** The curated list. Read-only to clients; maintained via migrations. */
  @Get()
  list() {
    return this.db
      .select({
        id: drinks.id,
        name: drinks.name,
        normalized_name: drinks.normalizedName,
        is_alcoholic: drinks.isAlcoholic,
      })
      .from(drinks)
      .orderBy(asc(drinks.name));
  }
}
