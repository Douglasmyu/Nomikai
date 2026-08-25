import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

export const DB = 'DB';
export type Db = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      // Session pooler (IPv4). prepare: false is required by the pooler.
      useFactory: () =>
        drizzle(postgres(process.env.DATABASE_URL!, { prepare: false }), {
          schema,
        }),
    },
  ],
  exports: [DB],
})
export class DbModule {}
