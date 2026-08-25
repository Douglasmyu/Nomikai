import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PgErrorFilter } from './pg-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new PgErrorFilter());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
