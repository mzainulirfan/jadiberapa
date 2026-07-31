-- Add human-readable transaction number (nota) derived from id
alter table transactions add column if not exists number text;

update transactions set number = upper(substring(id::text, 1, 8)) where number is null;
