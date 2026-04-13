-- Add entry_type column to time_entries to support Work and Break entries
ALTER TABLE time_entries ADD COLUMN entry_type VARCHAR(20) DEFAULT 'work' CHECK (entry_type IN ('work', 'break'));

-- Create index for faster queries
CREATE INDEX idx_time_entries_type ON time_entries(entry_type);
