SECOND LEASH HUB — SUPABASE CONNECTED VERSION

1. Keep index.html and config.js together in the same folder.
2. Keep the assets folder beside them.
3. Open/host index.html from a web server (recommended) rather than relying on file://.
4. Sign in using the Supabase user you already created for Second Leash.
5. Your profile should load as SUPER ADMIN.

Security:
- config.js contains only the Supabase public/anon key.
- Do NOT replace it with a service_role or secret key.
- Row Level Security in Supabase is what protects the database.

Next build:
- real Dog Profile workflow
- foster accounts/permissions
- user management
- documents/storage
- notifications
