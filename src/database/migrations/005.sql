ALTER TABLE staff ADD COLUMN role_id TEXT;
ALTER TABLE staff_history ADD COLUMN old_role_id TEXT;
ALTER TABLE staff_history ADD COLUMN new_role_id TEXT;
UPDATE staff SET role_id=(
  SELECT json_extract(r.value,'$.roleId') FROM config c,json_each(c.body,'$.roles.ranks') r
  WHERE c.guild_id=staff.guild_id AND json_extract(r.value,'$.name')=staff.rank LIMIT 1
);
UPDATE staff_history SET new_role_id=(
  SELECT json_extract(r.value,'$.roleId') FROM config c,json_each(c.body,'$.roles.ranks') r
  WHERE c.guild_id=staff_history.guild_id AND json_extract(r.value,'$.name')=staff_history.new_rank LIMIT 1
),old_role_id=(
  SELECT json_extract(r.value,'$.roleId') FROM config c,json_each(c.body,'$.roles.ranks') r
  WHERE c.guild_id=staff_history.guild_id AND json_extract(r.value,'$.name')=staff_history.old_rank LIMIT 1
);
UPDATE config SET body=json_remove(body,'$.security','$.permissions','$.channels.security','$.staff.removeRolesOnDismissal'),revision=revision+1;
DROP TABLE sessions;
-- Oude incidenthistorie blijft bewaard tot de ingestelde logretentie verloopt.
