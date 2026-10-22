CREATE TABLE IF NOT EXISTS future_votes (
  voter_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (voter_id, concept_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS future_votes_concept ON future_votes(concept_id);
