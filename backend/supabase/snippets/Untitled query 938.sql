UPDATE auth.identities SET
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

UPDATE auth.users SET
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());