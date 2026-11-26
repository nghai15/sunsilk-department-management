import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { localUpgradeSql } from '../../frontend/scripts/sync-local-database.mjs';
const backend = new URL('../', import.meta.url);
const project = readFileSync(new URL('supabase/config.toml', backend), 'utf8').match(/^project_id\s*=\s*"([^"\r\n]+)"/m)[1];
const container = `supabase_db_${project}`;
const database = `sunsilk_install_test_${randomBytes(6).toString('hex')}`;
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] });
const sql = source => docker(['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'],source);
let created = false;
try {
  docker(['exec',container,'createdb','-U','postgres',database]); created = true;
  sql(`CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, instance_id uuid, aud text, role text, phone text, encrypted_password text, phone_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text, email_change_token_new text, email_change text, email_change_token_current text, phone_change text, phone_change_token text, reauthentication_token text);
    CREATE TABLE auth.identities(user_id uuid REFERENCES auth.users(id), provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,created_at timestamptz,updated_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon,service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;`);
  const names = readdirSync(new URL('supabase/migrations/', backend)).filter(n => n.endsWith('.sql')).sort();
  for (const name of names) {
    const content = readFileSync(new URL(`supabase/migrations/${name}`, backend),'utf8');
    assert.equal(content,readFileSync(new URL(`migrations/${name}`,backend),'utf8'),name);
    sql(content); console.log(`OK migration ${name}`);
  }
  const seed=readFileSync(new URL('seed/001_seed_data.sql',backend),'utf8');
  sql(seed);
  const counts=()=>sql("SELECT (SELECT count(*) FROM nguoi_dung)||','||(SELECT count(*) FROM hop_dong)||','||(SELECT count(*) FROM hoa_don)||','||(SELECT count(*) FROM thanh_toan);").trim();
  assert.equal(counts(),'5,2,6,3');
  assert.ok(sql(localUpgradeSql()).includes('SUNSILK_UPDATED'));
  assert.ok(!sql(localUpgradeSql()).includes('SUNSILK_UPDATED'));
  assert.equal(counts(),'5,2,6,3');
  sql(seed); assert.equal(counts(),'5,2,6,3');
  assert.equal(sql("SELECT count(*) FROM auth.users WHERE encrypted_password=crypt('123456',encrypted_password);").trim(),'5');
  for (const table of ['giao_dich_ngan_hang','phi_sua_chua','yeu_cau_hop_dong','mo_nhap_cong_to','cau_hinh_nhac_cong_to','nhat_ky_nhac_cong_to','quyet_toan_hop_dong']) assert.equal(sql(`SELECT to_regclass('public.${table}') IS NOT NULL;`).trim(),'t',table);
  assert.equal(sql("SELECT count(*) FROM storage.buckets WHERE id IN ('anh-cong-to','anh-su-co','bien-lai','hop-dong-goc');").trim(),'4');
  console.log('PASS: fresh install, seed rerun, automatic upgrade, skip unchanged version, preserved data.');
} finally {
  if (created && /^sunsilk_install_test_[a-f0-9]{12}$/.test(database)) docker(['exec',container,'dropdb','-U','postgres',database]);
}
