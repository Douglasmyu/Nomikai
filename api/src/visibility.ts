import { ForbiddenException } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { friendships } from './db/schema';

/**
 * The `is_friends_with` rule, moved into the API: the connection runs as
 * `postgres` and bypasses RLS, so every friend-gated read has to ask here.
 */
export async function isFriendsWith(db: Db, viewerId: string, otherId: string) {
  if (viewerId === otherId) return true;
  const [row] = await db
    .select({ ok: sql<number>`1` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.requesterId, viewerId),
            eq(friendships.addresseeId, otherId),
          ),
          and(
            eq(friendships.requesterId, otherId),
            eq(friendships.addresseeId, viewerId),
          ),
        ),
      ),
    )
    .limit(1);
  return !!row;
}

export async function assertCanSee(db: Db, viewerId: string, ownerId: string) {
  if (!(await isFriendsWith(db, viewerId, ownerId))) {
    throw new ForbiddenException('Friends only');
  }
}
