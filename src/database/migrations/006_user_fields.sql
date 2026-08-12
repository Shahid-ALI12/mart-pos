-- 006_user_fields.sql
-- Add must_change_password flag for force-password-change-on-first-login policy.
-- The default admin user (id=1, username='admin') is seeded with the well-known
-- password 'admin123', so we mark it as must-change. New users created via the
-- UI should also default to must_change_password = 0 (they choose their own password
-- at creation time).

ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;

-- Force the seeded admin user to change password on first login.
UPDATE users SET must_change_password = 1 WHERE username = 'admin';
