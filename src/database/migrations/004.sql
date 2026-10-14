ALTER TABLE giveaways ADD COLUMN commitment_published INTEGER NOT NULL DEFAULT 0;
UPDATE giveaways SET commitment_published=1 WHERE
  (round=1 AND message_id IS NOT NULL) OR
  EXISTS(SELECT 1 FROM outbox WHERE outbox.id=('round:' || giveaways.id || ':' || giveaways.round) AND outbox.state='sent');
