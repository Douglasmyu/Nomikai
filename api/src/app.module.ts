import { Module } from '@nestjs/common';
import { DbModule } from './db';
import { DrinksController } from './drinks.controller';
import { EntriesController } from './entries.controller';
import { FeedController } from './feed.controller';
import { FriendshipsController } from './friendships.controller';
import { NightOutsController } from './night-outs.controller';
import { ProfilesController } from './profiles.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [DbModule],
  controllers: [
    ProfilesController,
    EntriesController,
    FeedController,
    FriendshipsController,
    NightOutsController,
    DrinksController,
  ],
  providers: [StorageService],
})
export class AppModule {}
