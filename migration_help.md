# Moving VASTRA to another Windows device

This guide moves VASTRA by copying the project folder directly (USB drive, external drive, or another file-transfer method). It assumes Node.js and PostgreSQL are already installed on the new device.

VASTRA is a pnpm workspace with:

- a React/Vite frontend in `client`
- an Express backend in `server`
- a PostgreSQL database
- locally stored uploads in `server\uploads`
- locally stored frontend assets in `client\public`

Run commands in PowerShell from the project root (the folder containing the root `package.json`) unless a step says otherwise.

## Recommended migration route

For this project, the easiest way to preserve existing data is the built-in transfer workflow:

1. On the old device, run `pnpm transfer:export`.
2. Copy the whole project, including `migration\database-backup.json` and `server\uploads`.
3. On the new device, install dependencies and configure `server\.env` and `client\.env`.
4. Create an empty PostgreSQL database and run `pnpm migrate`.
5. Run `pnpm transfer:import` and then `pnpm transfer:verify`.

The built-in JSON backup includes database records and a checksum inventory of uploaded files. It does **not** put the upload file contents inside the JSON backup, so `server\uploads` must still be copied separately.

## 1. Before copying from the old device

### 1.1 Stop VASTRA

Close the terminals running the frontend or backend. This prevents an upload or database change from happening halfway through the copy.

### 1.2 Decide whether to move existing data

- For a new empty installation with demo data, skip the export and use the fresh-setup instructions later.
- To preserve accounts, products, orders, messages, and other existing records, export the database before copying.

The recommended project-specific export is:

```powershell
pnpm transfer:export
```

This reads the old device's `server\.env`, exports the configured database to `migration\database-backup.json`, and records checksums for files in `server\uploads`. The backup contains private account and message data, including password hashes. Store and transfer it securely.

If `pnpm` is unavailable on the old device but dependencies were previously installed, install the expected pnpm version with:

```powershell
npm install --global pnpm@10.0.0
```

The standard PostgreSQL `pg_dump` alternative is documented in section 5B.

### 1.3 What to copy and what to leave behind

| Item | Copy? | Reason |
| --- | --- | --- |
| Project source files, root `package.json`, `pnpm-lock.yaml`, `client`, `server`, and `shared` | Yes | These are required to install and run the same project. |
| Hidden example/configuration files such as `.env.example` and `.gitignore` | Yes | Some file-transfer tools hide dotfiles; confirm they are included. |
| `node_modules` folders | No | They are large, may contain device-specific binaries, and are recreated by `pnpm install`. |
| `.pnpm-store` | No | It is a dependency cache and can be recreated. |
| `server\.env` and `client\.env` | Prefer recreating them securely | They contain machine-specific settings and secrets. Copy them only through a secure method if the same credentials should be retained; never share them publicly. |
| `server\uploads` | **Yes** when keeping existing data | Product/media files are stored in `products`; profile copies in `profiles`; wardrobe images in `wardrobe`. Database rows refer to these paths. |
| `client\public` | Yes, as normal source files | It contains VASTRA's logo and local banner images. It should already be part of the copied project. |
| Browser local storage | No | VASTRA's browser token, theme, and client preferences belong to the old browser. Users should log in again on the new device. Database-backed wishlists remain after a database restore. |
| `migration\database-backup.json` | Yes, if using the built-in transfer | This is the existing-data export created by `pnpm transfer:export`. |
| PostgreSQL's internal data directory | **No** | Do not copy PostgreSQL service files directly. Use the built-in transfer, `pg_dump`, or `pg_restore`. |
| `client\dist`, `build`, or `build-check` | No | These are generated outputs. Rebuild them from source. |
| `*.log`, logs, cache, temp, and temporary editor files | No | They are not required and can contain stale machine paths or sensitive output. |
| `.git` | Optional | Git is not required for a direct-copy migration. Copy it only if repository history and local branches are wanted. |

After exporting, check that these two locations exist and are included in the copy:

```powershell
Test-Path .\migration\database-backup.json
Get-ChildItem .\server\uploads -Recurse -File
```

Copy the project folder only after the export finishes successfully.

## 2. Required installations on the new device

### Already installed: Node.js

VASTRA requires Node.js and npm. Verify both:

```powershell
node --version
npm --version
```

Use a current supported Node.js LTS release when possible. If these commands are not recognized, reopen PowerShell after installation or add Node.js to `PATH`.

### Already installed: PostgreSQL

Verify that the PostgreSQL server is running and that its command-line tools are accessible:

```powershell
psql --version
pg_dump --version
pg_restore --version
```

If those commands are not recognized even though PostgreSQL is installed, add its `bin` directory to Windows `PATH` (commonly `C:\Program Files\PostgreSQL\VERSION\bin`) or run the executables using their full paths. The built-in JSON transfer does not require `pg_dump` or `pg_restore`, but database/user creation still needs pgAdmin, SQL Shell (`psql`), or an equivalent PostgreSQL client.

### Install pnpm 10

The root `package.json` specifies `pnpm@10.0.0`. Install and verify it:

```powershell
npm install --global pnpm@10.0.0
pnpm --version
```

The version should report `10.0.0` (a compatible pnpm 10 release should also work).

### Other services and tools

- **SMTP email account:** Required for real registration/login OTP emails and order/status/receipt emails. The project uses Nodemailer. Gmail users need 2-Step Verification and a Gmail App Password; a normal Gmail password will not work.
- **Payment service:** None. The card checkout is a dummy/test-only flow and does not call a payment provider.
- **Image-processing software/native library:** None. The backend validates and writes base64 JPG, PNG, WEBP, GIF, MP4, and WEBM uploads using Node.js APIs.
- **Git:** Optional and not needed when copying files directly.
- **Build tools:** No separate compiler or global Vite installation is required; project dependencies provide Vite and the other JavaScript tools.

## 3. Put the copied project in place

Copy the folder to a normal writable location, for example `D:\VASTRA`. Avoid running the live project directly from a USB drive or a protected folder such as `C:\Program Files`.

Open PowerShell in the copied project root and confirm the important files:

```powershell
Get-ChildItem -Force
Test-Path .\package.json
Test-Path .\pnpm-lock.yaml
Test-Path .\server\.env.example
Test-Path .\client\.env.example
```

Install all workspace dependencies from the root:

```powershell
pnpm install --frozen-lockfile
```

If the lockfile was accidentally omitted or pnpm reports that it is incompatible, recopy `pnpm-lock.yaml`. As a last resort, `pnpm install` can regenerate dependency resolution, but it may select different package versions.

Do not run `npm install` separately inside `client` and `server`; this repository is configured as one pnpm workspace.

## 4. Configure environment variables

Create the environment files from the supplied examples:

```powershell
Copy-Item .\server\.env.example .\server\.env
Copy-Item .\client\.env.example .\client\.env
notepad .\server\.env
notepad .\client\.env
```

If securely copied `.env` files already exist, compare them with the `.env.example` files so newer variable names are not missed.

### `server\.env`

The backend reads these actual variables:

```env
DATABASE_URL=postgres://DB_USER_HERE:DB_PASSWORD_HERE@localhost:5432/DB_NAME_HERE
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
HOST=0.0.0.0
PORT=5000
FRONTEND_PORT=5173
CLIENT_URL=http://localhost:5173
CLIENT_URLS=
SERVER_PUBLIC_URL=http://localhost:5000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=YOUR_EMAIL_HERE
EMAIL_PASS=YOUR_SMTP_OR_APP_PASSWORD_HERE
EMAIL_FROM="VASTRA <YOUR_EMAIL_HERE>"
```

What to change:

- `DATABASE_URL`: Must match the new device's PostgreSQL host, port, database, user, and password. Percent-encode reserved URL characters in the username/password (for example, `@` becomes `%40`), or choose a password that is safe in a URL.
- `JWT_SECRET`: It is required. Keep the old value if preserving existing login tokens; otherwise generate a new long random value. Changing it logs existing sessions out, which is usually harmless during a device move.
- `HOST`: Keep `0.0.0.0` for local and same-router access. Use `127.0.0.1` only if the backend must be limited to this computer.
- `PORT`: Keep `5000` unless that port is occupied.
- `FRONTEND_PORT`: Keep `5173` unless Vite uses a different port; it must match the frontend port for CORS.
- `CLIENT_URL`: Keep `http://localhost:5173` for use on the new computer. Change it to the exact deployed frontend origin if deployed.
- `CLIENT_URLS`: Optional comma-separated extra exact frontend origins. For example, `http://127.0.0.1:5173,http://192.168.1.25:5173`.
- `SERVER_PUBLIC_URL`: This value is present in the supplied environment example and can remain `http://localhost:5000` for local use. The current mailer attaches resolvable local product images inline and does not currently read this value; keep it for compatibility with the project's documented configuration.
- `EMAIL_*`: Keep the same SMTP details only if the credentials remain valid. Otherwise configure the new SMTP account. For Gmail, use an App Password in `EMAIL_PASS`.

`NODE_ENV` is recognized by authentication code but is not required in the local `.env` example. Do not add it unless a production runtime specifically needs it.

There are no Stripe, PayPal, or other payment environment variables because VASTRA's payment flow is a local dummy flow.

### `client\.env`

The frontend and Vite configuration use these actual variables:

```env
VITE_API_URL=
VITE_API_PORT=5000
# VITE_DEV_BACKEND_URL=http://127.0.0.1:5000
```

- For normal local development, leave `VITE_API_URL` blank. Vite proxies `/api`, `/uploads`, and Socket.IO to the backend.
- `VITE_API_PORT` must match backend `PORT` when using the default proxy.
- `VITE_DEV_BACKEND_URL` is optional and overrides the complete Vite proxy target.
- Set `VITE_API_URL` only when the API is at another origin, for example `https://api.example.com/api`. It should include `/api`.

Vite reads client environment variables when it starts/builds, so restart the frontend after editing `client\.env`.

Never commit or publicly share the real `.env` files.

## 5. PostgreSQL migration

First create a PostgreSQL login and empty database. The simplest beginner route is pgAdmin: create a Login/Group Role with login permission, then create a Database owned by that role.

Alternatively, open **SQL Shell (psql)**, connect as the `postgres` administrator, and run:

```sql
CREATE ROLE DB_USER_HERE WITH LOGIN PASSWORD 'DB_PASSWORD_HERE';
CREATE DATABASE DB_NAME_HERE OWNER DB_USER_HERE;
\q
```

Replace every placeholder. If the role already exists, do not create it again; reset its password if necessary:

```sql
ALTER ROLE DB_USER_HERE WITH PASSWORD 'DB_PASSWORD_HERE';
```

Then put the matching values in `server\.env` and test the connection:

```powershell
psql -h localhost -p 5432 -U DB_USER_HERE -d DB_NAME_HERE -c "SELECT current_database(), current_user;"
```

### 5A. Fresh setup (no old database data)

Run every SQL migration in filename order through the project's migration script:

```powershell
pnpm migrate
```

For optional demo accounts and products, run:

```powershell
pnpm seed
```

**Warning:** `pnpm seed` deletes and replaces application records. Use it only for a new/demo database, never after importing or restoring real data.

The seeded logins are:

- `admin@example.com` / `Admin123!`
- `user@example.com` / `User123!`
- `vendor@example.com` / `Vendor123!`

Change or remove demo credentials before any real/public use.

### 5B. Move existing data (recommended built-in transfer)

On the old device, while `server\.env` points to the old database:

```powershell
pnpm transfer:export
```

Copy both `migration\database-backup.json` and the entire `server\uploads` directory as part of the project copy.

On the new device, point `server\.env` to a newly created, empty database, then run:

```powershell
pnpm install --frozen-lockfile
pnpm migrate
pnpm transfer:import
pnpm transfer:verify
```

The importer refuses to overwrite a non-empty target database by default. That safeguard is intentional. Prefer creating another empty database rather than forcing an overwrite. If replacement is definitely intended and a separate backup exists, the underlying server command supports `pnpm --filter server run transfer:import -- --force`.

`pnpm transfer:verify` compares table contents with the export and verifies every upload recorded during export. A missing or changed upload makes verification fail.

### 5C. Move existing data with standard PostgreSQL tools

Use this alternative when a native PostgreSQL archive is preferred.

On the old device:

```powershell
New-Item -ItemType Directory -Force .\migration
pg_dump -h localhost -p 5432 -U DB_USER_HERE -F c -f .\migration\vastra.backup DB_NAME_HERE
```

Copy `migration\vastra.backup` and `server\uploads` to the new device.

On the new device, create an empty database as described above, then restore:

```powershell
pg_restore -h localhost -p 5432 -U DB_USER_HERE -d DB_NAME_HERE --no-owner .\migration\vastra.backup
pnpm migrate
```

Running `pnpm migrate` afterward ensures migrations included in the copied project are applied. VASTRA's migration SQL is designed to run in sorted order and uses guards for schema additions.

For a plain SQL dump instead:

```powershell
pg_dump -h localhost -p 5432 -U DB_USER_HERE -F p -f .\migration\vastra.sql DB_NAME_HERE
psql -h localhost -p 5432 -U DB_USER_HERE -d DB_NAME_HERE -f .\migration\vastra.sql
pnpm migrate
```

Do not mix restore approaches into the same non-empty database. Use either the built-in JSON transfer, a custom-format archive, or a plain SQL dump.

## 6. Uploaded images and local assets

VASTRA serves local uploads at `/uploads` from:

```text
server\uploads\products   product images and product/chat media
server\uploads\profiles   saved profile-image copies
server\uploads\wardrobe   wardrobe images
```

Copy the entire `server\uploads` directory without renaming files or subfolders. Database fields store URLs such as `/uploads/products/filename.jpg`; if a file is absent, the product image, wardrobe image, chat media, or email image attachment can be broken. The backend creates missing upload folders when it starts, but it cannot recreate old file contents.

Profile image data is also retained in database records by the current code, but the saved `profiles` copies should still be migrated for a complete, verifiable transfer.

After copying, check the files:

```powershell
Get-ChildItem .\server\uploads -Recurse -File
```

When using the built-in database transfer, use the stronger verification:

```powershell
pnpm transfer:verify
```

Frontend static files under `client\public` (including `vastra.png` and banner images) are normal project source assets. They are copied with the project and included in a new Vite build.

## 7. Verify and start VASTRA

Run the project's checks:

```powershell
pnpm check
```

Start backend and frontend together:

```powershell
pnpm dev
```

Then open `http://localhost:5173`. The backend health endpoint is `http://localhost:5000/api/health`.

To run separate terminals:

```powershell
pnpm dev:server
```

```powershell
pnpm dev:client
```

For the backend without file watching:

```powershell
pnpm --filter server start
```

For a frontend production build and local preview:

```powershell
pnpm --filter client build
pnpm --filter client preview
```

The Vite preview is only a preview server, not a complete production deployment setup.

## 8. Troubleshooting

### Database connection failed

- Confirm PostgreSQL is running in Windows Services.
- Recheck every part of `DATABASE_URL`: username, encoded password, host, port, and database name.
- Test with `psql -h localhost -p 5432 -U DB_USER_HERE -d DB_NAME_HERE`.
- Confirm the role has permission to connect to and create objects in the database.
- Restart the backend after changing `server\.env`.

### `password authentication failed` or PostgreSQL authentication errors

- The password in `DATABASE_URL` must match the PostgreSQL role password, not the Windows password.
- Reset it as an administrator with `ALTER ROLE DB_USER_HERE WITH PASSWORD 'DB_PASSWORD_HERE';`.
- Percent-encode reserved characters in the URL password.
- Check PostgreSQL's `pg_hba.conf` only if valid credentials are still rejected; restart PostgreSQL after changing it.

### `relation ... does not exist`, missing table, or missing type

- Confirm `server\.env` points to the intended database.
- Run `pnpm migrate` from the project root.
- Do not run the transfer import until migrations have created the schema.

### Transfer import says the database is not empty

- The safest fix is to create another empty database, update `DATABASE_URL`, run `pnpm migrate`, and import again.
- Use `--force` only when intentionally replacing the database and after keeping an independent backup.

### Port already in use

Find the process using a port:

```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
```

Stop the old process, or change backend `PORT`, server `FRONTEND_PORT`, client `VITE_API_PORT`, and frontend/CORS URLs consistently. Vite may automatically select another frontend port; if it does, update `FRONTEND_PORT` and `CLIENT_URL`, then restart both servers.

### Frontend cannot reach the backend

- Confirm `http://localhost:5000/api/health` returns JSON.
- For normal development, leave `VITE_API_URL` blank and ensure `VITE_API_PORT` matches backend `PORT`.
- Restart Vite after changing `client\.env`.
- Check browser developer tools for the failing URL and status.
- If using another API origin, include `/api` in `VITE_API_URL`.

### CORS error or API URL issue

- `CLIENT_URL` must exactly match the frontend origin, including protocol and port.
- Put other exact origins in comma-separated `CLIENT_URLS`.
- Do not use `https://` for one local server and `http://` for the other unless both are intentionally configured for HTTPS.
- For same-router testing, leave `VITE_API_URL` blank so Vite proxies API, uploads, and Socket.IO through port 5173.

### Images do not load

- Confirm the matching files exist under `server\uploads` with unchanged names.
- Open an affected `/uploads/...` URL directly in the browser.
- Confirm the backend is running and the Vite `/uploads` proxy is active.
- Run `pnpm transfer:verify` if the built-in backup was used.
- Confirm `client\public` was copied for logo/banner assets.

### Email/OTP does not send

- Check all `EMAIL_*` values in `server\.env` and restart the backend.
- For Gmail, enable 2-Step Verification and use an App Password.
- Ensure `EMAIL_PORT=465` and `EMAIL_SECURE=true` match the SMTP provider; other providers may require port 587 and `EMAIL_SECURE=false`.
- Check firewall/antivirus rules and the backend terminal error.
- SMTP is required for new-user verification, login OTP, and order/status/receipt emails.

### Dependency installation fails

- Verify `node --version`, `npm --version`, and `pnpm --version`.
- Confirm the copied `pnpm-lock.yaml` is present and use pnpm 10.
- Delete only newly generated `node_modules` folders, then rerun `pnpm install --frozen-lockfile`. Do not delete source files or the lockfile.
- Check internet/proxy/antivirus settings; dependency installation requires package-registry access.
- Do not reuse `node_modules` copied from the old device.

### Wrong `.env` values appear to be ignored

- The files must be exactly `server\.env` and `client\.env`, not `.env.txt` (enable **File name extensions** in Windows Explorer).
- Backend commands load `server\.env` because pnpm runs the server workspace in that directory.
- Restart backend and frontend after changes; Vite reads variables at startup.
- Only variables beginning with `VITE_` are exposed to frontend code.

## 9. Final checklist

- [ ] Entire project source copied, including dotfiles and `pnpm-lock.yaml`
- [ ] Old `node_modules`, caches, logs, and `client\dist` excluded
- [ ] Node.js, npm, PostgreSQL, and pnpm versions verified
- [ ] `pnpm install --frozen-lockfile` completed
- [ ] `server\.env` configured with the new PostgreSQL connection and a valid `JWT_SECRET`
- [ ] `client\.env` configured; local development normally has blank `VITE_API_URL`
- [ ] New PostgreSQL database and role created
- [ ] Database migrated and either seeded fresh or restored (not both)
- [ ] `server\uploads` copied with filenames and folders unchanged
- [ ] `pnpm transfer:verify` passed when using the built-in transfer
- [ ] `pnpm check` passed
- [ ] Backend starts and `/api/health` responds
- [ ] Frontend starts at `http://localhost:5173`
- [ ] Register, email OTP verification, login, and logout tested
- [ ] Existing products and product images load
- [ ] Cart and checkout tested
- [ ] Order confirmation/status email and PDF receipt features tested
- [ ] Wardrobe/profile/chat images tested if existing data uses them

## Exact command sequence for the recommended existing-data move

Old device, from the project root:

```powershell
pnpm transfer:export
Test-Path .\migration\database-backup.json
Get-ChildItem .\server\uploads -Recurse -File
```

After copying the whole project, new device, from the copied project root:

```powershell
node --version
npm --version
psql --version
npm install --global pnpm@10.0.0
pnpm --version
pnpm install --frozen-lockfile
Copy-Item .\server\.env.example .\server\.env
Copy-Item .\client\.env.example .\client\.env
notepad .\server\.env
notepad .\client\.env
psql -h localhost -p 5432 -U DB_USER_HERE -d DB_NAME_HERE -c "SELECT current_database(), current_user;"
pnpm migrate
pnpm transfer:import
pnpm transfer:verify
pnpm check
pnpm dev
```

Create the PostgreSQL role and database before the connection-test command, and replace all placeholders in `server\.env` and the command line.
