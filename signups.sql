-- News and FTW box waitlist sign-ups, bound to the Pages Worker as SIGNUPS_DB.
-- Kept apart from the anonymous future votes: this table holds email addresses.
CREATE TABLE IF NOT EXISTS signups (
  email TEXT NOT NULL,
  list TEXT NOT NULL CHECK (list IN ('news', 'gateway')),
  country TEXT,
  consent TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (email, list)
) WITHOUT ROWID;
