-- KINGMAKER v3: ensure only one archived DEV KING per UTC day.
create unique index if not exists idx_kings_period_unique on kings(period);
