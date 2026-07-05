# VASTRA

VASTRA is a full-stack clothing e-commerce system with a React storefront, Express API, PostgreSQL data source, JWT authentication, role-based authorization, vendor product approval, carts, orders, contact messages, and light/dark themes.

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, PostgreSQL, `pg`, JWT, bcryptjs, Zod, Nodemailer
- Roles: `user`, `vendor`, `admin`

## Features By Role

- Public visitors can browse approved products, view product details, use search/filters, submit contact messages, login, and register.
- Users can manage cart items, checkout, view their own orders, and access their account page.
- Vendors can do user actions, manage only their own products, and see product approval status. Vendor uploads start as `pending`.
- Admins can view stats, users/vendors, all products, pending approvals, all orders, contact messages, approve/reject products, update order status, and delete/update products.

## Setup

This repository uses pnpm workspaces:

```powershell
pnpm install
```

Create or edit `server\.env`:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-this-with-a-long-random-secret
PORT=5000
CLIENT_URL=http://127.0.0.1:5173
SERVER_PUBLIC_URL=http://127.0.0.1:5000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=my_email@gmail.com
EMAIL_PASS=my_gmail_app_password
EMAIL_FROM="VASTRA <my_email@gmail.com>"
```

For Gmail, use a Gmail App Password for `EMAIL_PASS`; do not use your normal Gmail password.
Order emails build product image URLs from `SERVER_PUBLIC_URL`. When emails are opened outside your computer, set it to a publicly reachable HTTPS backend URL (for example, your deployed API or tunnel URL) rather than `localhost` or `127.0.0.1`.

Create or edit `client\.env`:

```env
VITE_API_URL=http://127.0.0.1:5000/api
```

## Database

Run migrations and seed data after `DATABASE_URL` points to a reachable PostgreSQL database:

```powershell
pnpm migrate
pnpm seed
```

Seeded credentials:

- Admin: `admin@example.com` / `Admin123!`
- User: `user@example.com` / `User123!`
- Vendor: `vendor@example.com` / `Vendor123!`

Seeded `@example.com` accounts are marked as email-verified so they can be used without OTP.

## Dummy Card Payment

Use these test-only details when selecting **Card** at checkout:

- Cardholder name: `VASTRA Test Customer`
- Card number: `4242 4242 4242 4242`
- Expiry date: `12/30`
- CVV: `123`

This is a dummy payment flow and does not contact a real payment processor. VASTRA stores only the cardholder name, expiry date, and final four digits; the full card number and CVV are never stored.

## Email Verification

Public registration always creates a normal `user` account with `email_verified = false`.
The API sends a 6-digit OTP to the registered email address using the SMTP settings in `server\.env`.
The OTP is stored only as a bcrypt hash, expires after 10 minutes, and is cleared after successful verification.

To test the flow:

1. Start the backend with valid SMTP credentials in `server\.env`.
2. Register with a real email address.
3. Open `/verify-email`, enter the email and OTP from the message.
4. Login after verification succeeds.

## Run

Backend:

```powershell
pnpm dev:server
```

Frontend:

```powershell
pnpm dev:client
```

Or run both:

```powershell
pnpm dev
```

## API Summary

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification-otp`
- `GET /api/auth/me`

Products:

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/vendor/products`
- `GET /api/vendor/orders`
- `PATCH /api/vendor/orders/:id/status`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id/approve`
- `PATCH /api/admin/products/:id/reject`

Cart and orders:

- `GET /api/cart`
- `POST /api/cart`
- `PUT /api/cart/:itemId`
- `DELETE /api/cart/:itemId`
- `GET /api/wishlist`
- `POST /api/wishlist`
- `DELETE /api/wishlist/:productId`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`

Contact and admin:

- `POST /api/contact`
- `GET /api/admin/contact-messages`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `GET /api/admin/stats`

## Verification Notes

Server files were syntax-checked with `node --check`.

Full local workflow verification requires:

1. A reachable PostgreSQL `DATABASE_URL`.
2. A completed pnpm install. In this Codex environment, pnpm downloaded packages but repeatedly stalled while verifying/fetching optional Rollup/esbuild platform packages, so the Vite build and live manual browser workflows could not be completed here.

Once dependencies and PostgreSQL are available, run:

```powershell
pnpm install
pnpm migrate
pnpm seed
pnpm check
pnpm dev
```

Then test: register user, register vendor, login, create pending vendor product, approve as admin, view in shop, add to cart, checkout, update order status, submit contact form, and toggle theme.
