ALTER TABLE sanctions ADD COLUMN retry_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE giveaways ADD COLUMN mode TEXT NOT NULL DEFAULT 'normal';
CREATE TABLE managed_messages (guild_id TEXT NOT NULL, kind TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(guild_id,kind));
