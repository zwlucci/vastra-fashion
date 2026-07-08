# VASTRA GitHub Migration Help

This guide explains how to use GitHub to move VASTRA between devices instead of copying the project with a pendrive.

VASTRA is a pnpm workspace:

- `client`: React/Vite frontend
- `server`: Express backend
- `server/migrations`: PostgreSQL schema migrations
- `server/uploads`: local uploaded files, intentionally not committed

Run commands from the project root unless a step says otherwise.

## 1. Push from this computer

This project already has a GitHub remote:

```bash
git remote -v
```

Stage and commit safe project files:

```bash
git add .
git commit -m "Prepare project for GitHub migration"
```

Push the `main` branch:

```bash
git push -u origin main
```

If authentication fails, sign in with one of these:

```bash
gh auth login
```

or use Git Credential Manager / a GitHub personal access token when Git asks for credentials.

## 2. Clone on another device

Install Git, Node.js, PostgreSQL, and pnpm first. Then clone the repository:

```bash
git clone https://github.com/zwlucci/vastra-fashion.git
cd vastra-fashion
```

Install dependencies:

```bash
npm install --global pnpm@10.0.0
pnpm install --frozen-lockfile
```

## 3. Create environment files

Real `.env` files are intentionally not pushed to GitHub. Create them from the examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

On Windows PowerShell, use:

```powershell
Copy-Item .\server\.env.example .\server\.env
Copy-Item .\client\.env.example .\client\.env
```

Edit `server/.env` and set safe local values:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
JWT_SECRET=replace_with_secure_secret
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password
CLIENT_URL=http://localhost:5173
```

Also review the other variables already listed in `server/.env.example`, such as `HOST`, `PORT`, `FRONTEND_PORT`, `CLIENT_URLS`, `SERVER_PUBLIC_URL`, and `EMAIL_FROM`.

For local development, `client/.env` can usually keep:

```env
VITE_API_URL=
VITE_API_PORT=5000
```

## 4. Set up PostgreSQL locally

Create a PostgreSQL user and empty database. In `psql`, connected as an administrator:

```sql
CREATE ROLE username WITH LOGIN PASSWORD 'password';
CREATE DATABASE database_name OWNER username;
```

Then make sure `server/.env` uses the same database name, username, and password in `DATABASE_URL`.

Test the connection:

```bash
psql -h localhost -p 5432 -U username -d database_name -c "SELECT current_database(), current_user;"
```

## 5. Run database migrations

This project already has SQL migrations in `server/migrations` and a root script for them.

Run:

```bash
pnpm migrate
```

For optional demo data on a fresh database:

```bash
pnpm seed
```

Do not run `pnpm seed` on a database that already contains real data unless you intentionally want demo/reset data.

## 6. Start the project

Start the client and server together:

```bash
pnpm dev
```

Or start them separately:

```bash
pnpm dev:server
pnpm dev:client
```

Open:

```text
http://localhost:5173
```

The backend health endpoint is:

```text
http://localhost:5000/api/health
```

## 7. Files intentionally not pushed

These are ignored because they are generated, private, local-only, or too large for normal GitHub source control:

- `node_modules/`
- `.pnpm-store/`
- `.env` and `.env.*`, except `.env.example`
- `server/uploads/`
- `migration/`
- `dist/`, `build/`, `.vite/`, `build-check/`, and `coverage/`
- log files such as `*.log`, `npm-debug.log*`, `pnpm-debug.log*`, and `yarn-debug.log*`
- OS files such as `.DS_Store` and `Thumbs.db`
- `remote_control_token.txt`

If you need existing uploaded product/profile/wardrobe images on another device, copy `server/uploads/` manually through a private method. GitHub will not contain those uploads.

If you need existing database data, export/import it privately. This project has helper scripts:

```bash
pnpm transfer:export
pnpm transfer:import
pnpm transfer:verify
```

The generated `migration/` folder is intentionally ignored because database backups can contain private user/order data.

## 8. Pull latest changes on another device

When another device already has the repository cloned:

```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm migrate
pnpm dev
```

## 9. Push future changes

After editing the project:

```bash
git status
git add .
git commit -m "Describe changes"
git push origin main
```

Before each push, confirm that real `.env` files, uploads, database backups, passwords, email credentials, tokens, and API keys are not staged.
