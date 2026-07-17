# VASTRA

VASTRA is a full-stack clothing e-commerce application built with a React/Vite frontend, an Express API, and a PostgreSQL database. It supports product browsing, vendor-managed product listings, admin product approval, cart and checkout, dummy card or cash-on-delivery payment records, orders, returns, reviews, wishlist, wardrobe combinations, contact messages, newsletters, notifications, and realtime message/order updates.

## Table of Contents

- [1. Project Title and Overview](#1-project-title-and-overview)
- [2. Technology Stack](#2-technology-stack)
- [3. High-Level System Architecture](#3-high-level-system-architecture)
- [4. Complete Folder and File Structure](#4-complete-folder-and-file-structure)
- [5. Frontend Architecture](#5-frontend-architecture)
- [6. Backend Architecture](#6-backend-architecture)
- [7. API Documentation](#7-api-documentation)
- [8. Database Architecture](#8-database-architecture)
- [9. Authentication and Authorization](#9-authentication-and-authorization)
- [10. User Roles and Permissions](#10-user-roles-and-permissions)
- [11. Main Feature Workflows](#11-main-feature-workflows)
- [12. Error Handling](#12-error-handling)
- [13. Environment Variables and Configuration](#13-environment-variables-and-configuration)
- [14. Installation and Local Development](#14-installation-and-local-development)
- [15. Development Commands](#15-development-commands)
- [16. How to Explain the Project to Other People](#16-how-to-explain-the-project-to-other-people)
- [17. Debugging Guide](#17-debugging-guide)
- [18. Security Notes](#18-security-notes)
- [19. Current Limitations and Future Improvements](#19-current-limitations-and-future-improvements)
- [20. Glossary](#20-glossary)
- [21. Contributor Guide](#21-contributor-guide)
- [22. Important Files Quick Reference](#22-important-files-quick-reference)

## 1. Project Title and Overview

**Project name:** VASTRA

VASTRA is a marketplace-style fashion storefront. Customers browse approved clothing and accessory products, add them to a cart or wishlist, check out, track orders, request returns, and message vendors or admins. Vendors manage their own product listings and order delivery statuses. Admins review product submissions, manage users, coupons, newsletters, homepage category shortcuts, reviews, wardrobe settings, contact conversations, and overall dashboard statistics.

The main problem VASTRA solves is the coordination problem in a multi-role e-commerce system: customers need a simple shopping experience, vendors need a place to publish and manage inventory, and admins need moderation and operational tools.

**Intended users**

| User type | Purpose in the system |
| --- | --- |
| Guest | Browse products, view vendors, register, login, subscribe to newsletter, and send contact messages. |
| User/customer | Shop, wishlist, checkout, review eligible products/vendors, manage account, messages, wardrobe, orders, cancellations, and returns. |
| Vendor | Manage own products, see approval state, handle vendor orders and return decisions, receive vendor messages and stock alerts. |
| Admin | Moderate products/reviews/users, inspect orders/contact messages, manage coupons/newsletters/homepage shortcuts/wardrobe products. |

**Key features currently available**

- Public storefront: home page, shop page, category shortcuts, product details, vendor profiles, search suggestions, filters, sorting, and product media.
- Authentication: registration, email OTP verification, login, login OTP challenge for untrusted/sensitive logins, JWT-protected API access, local profile updates, and role checks.
- Product management: vendor product create/update/delete, admin approve/reject, product media upload, sizes, size-specific prices, colors, gender, stock, low/out-of-stock alerts, wishlist price-drop notifications.
- Shopping: cart, wishlist, checkout, coupons, order creation, dummy card payment records, cash on delivery, order timeline, order cancellation, and returns.
- Communication: contact form, admin contact conversation opening, vendor conversations, unread counts, conversation archive/delete, Socket.IO realtime events.
- Reviews: general review/testimonial route plus product/vendor entity reviews with purchase eligibility checks for product reviews.
- Admin/vendor dashboards: statistics, order history, products, returns, coupons, newsletter broadcasts, homepage categories, users, and wardrobe settings.
- Wardrobe: user wardrobe items and outfit/combo boards; admin can enable products for wardrobe and upload wardrobe images.

**Project in one paragraph**

VASTRA is a React, Express, and PostgreSQL e-commerce platform for fashion products. Customers can browse approved products, manage carts and wishlists, place orders, receive notifications, and request returns. Vendors can upload products, wait for admin approval, manage delivery statuses, and respond to return requests. Admins control moderation and operations through dashboards for users, products, orders, coupons, newsletters, contact messages, reviews, and homepage settings. The backend protects sensitive actions with JWT authentication, role middleware, Zod validation, PostgreSQL constraints, transactions, and Socket.IO updates.

## 2. Technology Stack

| Category | Technology | What it is | Where it is used | Why it is needed |
| --- | --- | --- | --- | --- |
| Frontend | React 18 | UI library for components and state-driven rendering. | `client/src/main.jsx`, `client/src/App.jsx`, `client/src/pages`, `client/src/components`, `client/src/context`. | Builds the storefront, dashboards, forms, and shared UI. |
| Frontend | Vite | Development server and frontend build tool. | `client/vite.config.js`, `client/package.json`. | Runs the React app on port 5173 and proxies API, uploads, and Socket.IO during development. |
| Frontend routing | React Router DOM | Client-side routing library. | `client/src/App.jsx`, `ProtectedRoute.jsx`. | Maps browser paths such as `/shop`, `/orders`, `/vendor/dashboard/:section`, and `/admin/dashboard/:section` to React pages. |
| HTTP client | Axios | Promise-based HTTP client. | `client/src/api/client.js`. | Sends API requests and attaches `Authorization: Bearer <token>` from localStorage. |
| Realtime frontend | socket.io-client | Browser client for Socket.IO. | `client/src/context/MessageContext.jsx`. | Receives unread message counts, order notifications, product/order updates, and cart stock invalidation. |
| Styling | Tailwind CSS, PostCSS, Autoprefixer | Utility-first CSS and CSS processing tools. | `client/tailwind.config.js`, `client/postcss.config.js`, `client/src/index.css`. | Provides the visual design, responsive layout, panels, buttons, dark mode classes, and form styling. |
| Icons | lucide-react | React icon library. | Navbar, dashboard, product, cart, admin, and form components. | Supplies consistent UI icons. |
| Backend | Node.js ESM | JavaScript runtime using ES modules. | `server/package.json`, `server/src/**/*.js`. | Runs the API server and scripts. |
| Backend | Express | HTTP server framework. | `server/src/app.js`, `server/src/routes`. | Registers middleware, API routes, static uploads, health checks, and error handling. |
| Realtime backend | Socket.IO | WebSocket/polling realtime layer. | `server/src/server.js`, `server/src/socket.js`. | Pushes message, notification, product, order, dashboard, and stock events to logged-in users. |
| Database | PostgreSQL | Relational database. | `server/migrations/*.sql`, `server/src/config/db.js`, controllers. | Stores users, products, carts, orders, reviews, messages, coupons, newsletters, notifications, returns, and settings. |
| Database client | `pg` | PostgreSQL client for Node.js. | `server/src/config/db.js`. | Executes parameterized SQL queries and transactions. |
| Authentication | JWT (`jsonwebtoken`) | Signed access token format. | `server/src/controllers/authController.js`, `server/src/middleware/auth.js`, `server/src/socket.js`. | Proves the identity and role of the logged-in user for protected HTTP and Socket.IO requests. |
| Password/OTP hashing | bcryptjs | Password hashing library. | `authController.js`, `server/scripts/seed.js`. | Hashes passwords and OTP codes before storage. |
| Validation | Zod | Schema validation library. | `server/src/utils/validators.js`, route files. | Validates request bodies for auth, products, checkout, messages, coupons, newsletters, returns, and profiles. |
| Email | Nodemailer | SMTP email library. | `server/src/utils/mailer.js`. | Sends email verification OTPs, login OTPs, order confirmations, status emails, receipts, return emails, and newsletters. |
| PDF generation | pdfkit | PDF creation library. | `server/src/utils/receiptPdf.js`. | Generates order and return receipt PDFs for emails. |
| File/media handling | Base64 upload utilities | Server-side upload helpers. | `server/src/utils/imageUpload.js`, `server/src/app.js`. | Stores product images/videos and homepage/wardrobe images under `server/uploads`; profile avatars are stored as data URLs after validation. |
| Security middleware | Helmet, CORS | HTTP header hardening and cross-origin control. | `server/src/app.js`. | Adds safer HTTP headers and restricts API origins to configured/local development origins. |
| Logging | Morgan | HTTP request logger. | `server/src/app.js`. | Prints API request logs in development. |
| Package manager | pnpm 10 | Workspace package manager. | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`. | Installs and runs both `client` and `server` workspaces. |
| Version control | Git | Source-control system. | `.gitignore`; normal branch/commit/PR workflow. | Tracks project changes while excluding dependencies, builds, and secrets. |

## 3. High-Level System Architecture

The browser loads the React application from Vite during development. React Router chooses the page component. Page components and context providers call the shared Axios instance in `client/src/api/client.js`. That instance sends requests to `/api` and attaches a JWT if `vastra_token` exists in localStorage.

In development, Vite proxies `/api`, `/uploads`, and `/socket.io` to the Express server configured by `client/vite.config.js`. Express receives the request in `server/src/app.js`, applies Helmet, CORS, JSON parsing, static upload serving, route registration, and finally error handling. Protected routes call `authenticateUser`, which verifies the JWT, fetches the user from PostgreSQL, checks suspension, and puts the serialized user on `req.user`. Role-protected routes then call `requireRole` or `requireAdmin`.

Routes stay thin. They validate request bodies with Zod where needed and call controllers. Controllers run parameterized PostgreSQL queries through `query()` or `withTransaction()` from `server/src/config/db.js`. Some controllers also call email utilities, upload utilities, notification utilities, and Socket.IO emitters. Responses return JSON to React, where local component or context state updates and the UI re-renders.

```mermaid
flowchart LR
    User["User in browser"] --> React["React app<br/>client/src"]
    React --> Router["React Router<br/>App.jsx"]
    Router --> Pages["Pages and contexts"]
    Pages --> Axios["Axios API client<br/>api/client.js"]
    Axios --> ViteProxy["Vite proxy<br/>/api /uploads /socket.io"]
    ViteProxy --> Express["Express app<br/>server/src/app.js"]
    Express --> Middleware["Helmet, CORS, JSON, auth, roles, Zod"]
    Middleware --> Routes["Route files<br/>server/src/routes"]
    Routes --> Controllers["Controllers<br/>server/src/controllers"]
    Controllers --> DB["PostgreSQL<br/>migrations/*.sql"]
    Controllers --> Mail["Nodemailer + PDFKit"]
    Controllers --> Uploads["server/uploads"]
    Controllers --> Socket["Socket.IO events"]
    DB --> Controllers
    Controllers --> Axios
    Socket --> React
    Axios --> Pages
```

## 4. Complete Folder and File Structure

Important project structure:

```text
.
|-- package.json
|-- pnpm-workspace.yaml
|-- pnpm-lock.yaml
|-- README.md
|-- vastra.png
|-- shared/
|   |-- currency.mjs
|   |-- productCategories.mjs
|   `-- productSizes.mjs
|-- client/
|   |-- package.json
|   |-- .env.example
|   |-- index.html
|   |-- vite.config.js
|   |-- tailwind.config.js
|   |-- postcss.config.js
|   |-- public/
|   |   |-- vastra.png
|   |   `-- banners/
|   `-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- index.css
|       |-- api/client.js
|       |-- context/
|       |-- pages/
|       |-- components/
|       `-- utils/
`-- server/
    |-- package.json
    |-- .env.example
    |-- migrations/
    |-- scripts/
    |-- src/
    |   |-- server.js
    |   |-- app.js
    |   |-- socket.js
    |   |-- config/db.js
    |   |-- middleware/
    |   |-- routes/
    |   |-- controllers/
    |   `-- utils/
    `-- uploads/           (created at runtime; should not contain committed secrets)
```

| Path | Responsibility | When to edit it |
| --- | --- | --- |
| `package.json` | Root workspace scripts. Calls client/server workspace scripts with pnpm filters. | Add cross-workspace scripts or update package manager metadata. |
| `pnpm-workspace.yaml` | Declares `client` and `server` as pnpm workspaces. | Only when adding another workspace package. |
| `shared/` | Shared constants used by both frontend and backend, such as categories, sizes, and currency formatting. | Add product categories/sizes or formatting shared by both sides. |
| `client/src/main.jsx` | Frontend startup. Wraps the app in providers and the router. | Add global providers, error boundaries, or app-wide initialization. |
| `client/src/App.jsx` | Frontend route table. | Add pages or change public/protected/role-based frontend paths. |
| `client/src/api/client.js` | Axios base URL, auth header injection, image URL helpers, error helper. | Change API URL behavior, token attachment, or image URL resolution. |
| `client/src/context/` | Global frontend state for auth, cart, wishlist, messages, notifications, and theme. | Change shared state or realtime behavior used across pages. |
| `client/src/pages/` | Route-level screens: shop, login, register, cart, orders, vendor/admin dashboards, messages, wardrobe, etc. | Add or modify user-facing workflows. |
| `client/src/components/` | Reusable UI pieces such as navbar, product cards/forms, dashboard tables, modals, review sections. | Change repeated UI or feature subcomponents. |
| `server/src/server.js` | Creates the HTTP server, initializes Socket.IO, checks `JWT_SECRET`, and listens on `HOST`/`PORT`. | Change server startup, host/port behavior, or realtime initialization. |
| `server/src/app.js` | Express app setup, middleware order, static uploads, health/root routes, API route mounts, error handlers. | Add middleware, route groups, upload folders, or CORS behavior. |
| `server/src/socket.js` | Socket.IO authentication and event emitters. | Add realtime events or change unread/order notification counts. |
| `server/src/config/db.js` | PostgreSQL connection pool, `query()`, and `withTransaction()`. | Change database connection or transaction helper behavior. |
| `server/src/middleware/auth.js` | JWT verification and role authorization helpers. | Change authentication, account suspension checks, or role permissions. |
| `server/src/routes/` | HTTP method/path registration and middleware composition. | Add an API endpoint or change required auth/validation for a route. |
| `server/src/controllers/` | Business logic and database queries. | Change feature behavior such as checkout, product approval, returns, messages, newsletters. |
| `server/src/utils/validators.js` | Zod schemas for request validation. | Change accepted request bodies or validation rules. |
| `server/src/utils/mailer.js` | SMTP email sending for OTP, orders, receipts, status changes, newsletters. | Change email contents or delivery configuration usage. |
| `server/src/utils/imageUpload.js` | Base64 image/video validation and upload storage. | Change allowed media types, size limits, or upload folders. |
| `server/migrations/` | SQL schema creation and evolution. | Add database tables/columns/indexes. Always document schema changes. |
| `server/scripts/migrate.js` | Reads all SQL files in sorted order and runs them. | Change migration execution strategy. |
| `server/scripts/seed.js` | Development seed data and demo accounts. | Update demo users, products, orders, notifications, or sample data. |

Changing a route file changes how requests enter a feature. Changing a controller changes the business rules and SQL. Changing a migration changes the database contract expected by controllers. Changing a context provider changes how many pages share frontend state.

## 5. Frontend Architecture

### Startup and rendering

1. `client/index.html` provides the root DOM element.
2. `client/src/main.jsx` mounts React with `ReactDOM.createRoot(...)`.
3. `main.jsx` wraps `App` with:
   - `AppErrorBoundary`
   - `BrowserRouter`
   - `ThemeProvider`
   - `AuthProvider`
   - `MessageProvider`
   - `NotificationProvider`
   - `CartProvider`
   - `WishlistProvider`
4. `client/src/App.jsx` maps URL paths to page components.
5. `client/src/components/Layout.jsx` renders shared layout, including navbar/footer around nested route content.

### Routing

Important routes from `client/src/App.jsx`:

| Browser path | Component | Access |
| --- | --- | --- |
| `/` | `Home` | Public |
| `/categories/:slug` | `CategoryProducts` | Public |
| `/shop` | `Shop` | Public |
| `/shop/:id` | `ProductDetail` | Public |
| `/vendors/:id` | `VendorProfile` | Public |
| `/contact` | `Contact` | Public |
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/verify-email` | `VerifyEmail` | Public |
| `/newsletter/unsubscribe` | `NewsletterUnsubscribe` | Public |
| `/profile` | `Account` | Public page that shows login/register prompt if guest |
| `/cart` | `Cart` | Public route, but cart API actions require login |
| `/wishlist` | `Wishlist` | Public route, but wishlist API actions require login |
| `/wardrobe` | `Wardrobe` | Public route, but wardrobe API actions require login |
| `/messages` | `Messages` | Public route, but message API actions require login |
| `/orders` | `Orders` | `ProtectedRoute` |
| `/orders/:id/success` | `OrderSuccess` | `ProtectedRoute` |
| `/vendor/dashboard/:section` | `VendorDashboard` | `RoleProtectedRoute roles={["vendor"]}` |
| `/admin/dashboard/:section` | `AdminDashboard` | `RoleProtectedRoute roles={["admin"]}` |
| `/admin/wardrobe` | `AdminWardrobe` | `RoleProtectedRoute roles={["admin"]}` |

`ProtectedRoute.jsx` redirects unauthenticated users to `/login`. `RoleProtectedRoute` redirects unauthenticated users to `/login` and users with the wrong role to `/profile`.

### API client

`client/src/api/client.js` creates the Axios instance:

- `API_BASE_URL` is `/api` by default.
- If `VITE_API_URL` is set, it is used unless it points to loopback and the browser is opened from a remote device.
- A request interceptor reads `localStorage.vastra_token` and sends `Authorization: Bearer <token>`.
- `getErrorMessage(error)` extracts `error.response.data.message`.
- `resolveImageUrl(url)` turns `/uploads/...` paths into full frontend-accessible URLs.

### Frontend state

| Context | File | Data managed |
| --- | --- | --- |
| Auth | `client/src/context/AuthContext.jsx` | Token, user, login, login OTP verification, register, email verification, profile update, logout. |
| Cart | `client/src/context/CartContext.jsx` | Cart items/count/total, add/update/remove, checkout, stock refresh on Socket.IO events. |
| Wishlist | `client/src/context/WishlistContext.jsx` | Wishlist items, badge count, toggle add/remove, local seen timestamp. |
| Messages | `client/src/context/MessageContext.jsx` | Socket.IO connection, unread message count, realtime auth with JWT. |
| Notifications | `client/src/context/NotificationContext.jsx` | Toast-like notices, order notification list, unread order notification count, realtime updates. |
| Theme | `client/src/context/ThemeContext.jsx` | Light/dark theme stored in `localStorage.vastra_theme` and applied to `document.documentElement`. |

### Forms and validation

The frontend performs user-friendly checks before API calls in files such as `Cart.jsx`, `ProductForm.jsx`, `Login.jsx`, `Register.jsx`, and dashboard components. The authoritative validation is still on the backend in `server/src/utils/validators.js`.

Examples:

- `ProductForm.jsx` checks image/video type and file size before converting media to base64.
- `Cart.jsx` validates checkout contact fields, dummy card fields, card expiry, and coupon application.
- `Login.jsx` handles the `requiresOtp` response from `/api/auth/login` and then calls `/api/auth/login/verify-otp`.

### Typical frontend action lifecycle

Example: adding a product to the cart.

```text
User clicks Add to Cart in ProductDetail/ProductCard
-> React event handler calls useCart().addToCart(productId, quantity, size, color)
-> CartContext sends POST /api/cart through api/client.js
-> Axios adds Authorization header if logged in
-> Express authenticates the JWT and validates cartSchema
-> cartController.addToCart checks product status, size/color, and stock
-> PostgreSQL inserts or updates cart_items
-> Backend returns the refreshed cart rows
-> CartContext updates items/count
-> Navbar cart badge and cart UI re-render
-> Any error is displayed through page state or NotificationContext
```

## 6. Backend Architecture

### Server startup

- `server/src/server.js` loads environment variables, requires `JWT_SECRET`, creates an HTTP server from `app`, calls `initSocket(server, corsOrigin)`, and listens on `HOST`/`PORT`.
- `server/src/app.js` builds the Express app and exports it.

### Middleware registration order

In `server/src/app.js`:

1. `dotenv.config()`
2. Helmet with `crossOriginResourcePolicy: "cross-origin"`
3. CORS with `corsOrigin`
4. `express.json({ limit: "22mb" })`
5. Runtime creation of upload folders
6. Static `/uploads` serving
7. Morgan request logging
8. Root route `/`, favicon, and `/api/health`
9. API route groups
10. `notFoundHandler`
11. `errorHandler`

### Routes, controllers, middleware, utilities, validation

| Layer | Meaning in this project | Example |
| --- | --- | --- |
| Route | Defines HTTP method/path and attaches middleware. | `server/src/routes/orderRoutes.js` maps `POST /api/orders` to `createOrder`. |
| Middleware | Runs before controllers for auth, roles, validation, or errors. | `authenticateUser`, `requireRole("vendor")`, `validate(checkoutSchema)`. |
| Controller | Contains feature logic and SQL calls. | `orderController.createOrder` validates stock, creates order rows, updates stock, sends notifications. |
| Utility | Shared helper used by controllers/middleware. | `mailer.js`, `imageUpload.js`, `coupons.js`, `serializers.js`. |
| Database query | Parameterized SQL run through `query()` or transaction client. | `SELECT * FROM users WHERE id = $1`. |
| Validation schema | Zod object that defines accepted request body shape. | `checkoutSchema`, `productSchema`, `registerSchema`. |

### Request lifecycle

```text
Frontend request
-> Express route in server/src/routes
-> authenticateUser, if protected
-> requireRole/requireAdmin, if role-restricted
-> validate(schema), if request body is structured
-> Controller in server/src/controllers
-> query() or withTransaction() in server/src/config/db.js
-> Optional mail/upload/notification/socket utility
-> JSON response or AppError
-> Frontend state update and re-render
```

### Realtime services

Socket.IO exists and is used. `server/src/socket.js` authenticates sockets with the same JWT secret. Events include:

- `unread:updated`
- `message:new`
- `messages:read`
- `conversation:updated`
- `conversation:deleted`
- `order-notification:new`
- `order-notifications:updated`
- `product:updated`
- `cart:stock-updated`
- `order:updated`
- `dashboard:updated`

No separate background worker or job queue is implemented. Email and notification side effects run inside controller flows, with some failures logged instead of failing the whole order flow.

## 7. API Documentation

Base URL in development through Vite: `/api`.

### Health and root

| Method | Path | Auth | Purpose | File |
| --- | --- | --- | --- | --- |
| GET | `/` | No | Basic API metadata. | `server/src/app.js` |
| GET | `/api/health` | No | Health check `{ ok: true, service: "vastra-api" }`. | `server/src/app.js` |

### Authentication

| Method | Path | Auth | Body/params | Purpose | Controller |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `name`, `email`, `password`, optional `phoneNumber`, `dateOfBirth` | Creates a normal `user` account, stores hashed password and email OTP hash, sends verification email. | `register` |
| POST | `/api/auth/login` | No | `email`, `password`, `deviceToken` | Validates credentials; may return token/user or `requiresOtp` challenge. | `login` |
| POST | `/api/auth/login/verify-otp` | No | `challengeId`, `otp`, `deviceToken` | Verifies login OTP, trusts the device, returns token/user. | `verifyLoginOtp` |
| POST | `/api/auth/login/resend-otp` | No | `challengeId` | Resends login OTP if allowed. | `resendLoginOtp` |
| POST | `/api/auth/verify-email` | No | `email`, `otp` | Verifies registration email OTP. | `verifyEmail` |
| POST | `/api/auth/resend-verification-otp` | No | `email` | Sends a new email verification OTP for an unverified account. | `resendVerificationOtp` |
| GET | `/api/auth/me` | User | Bearer token | Returns current serialized user. | `me` |
| PATCH | `/api/auth/me` | User | Profile fields, optional password change, profile image data | Updates profile; vendor brand fields only allowed for vendors. | `updateMe` |

Common auth errors: `401 Invalid email or password`, `401 Invalid or expired token`, `403 Please verify your email`, `403 Insufficient role`, `429 Too many failed attempts`.

### Products and vendors

| Method | Path | Auth/role | Query/body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/products` | Public | `search`, `category`, `gender`, `brand`, `minPrice`, `maxPrice`, `purchased`, `size`, `sort` | Lists approved products. |
| GET | `/api/products/suggestions` | Public | `q` | Returns product/category search suggestions. |
| GET | `/api/products/:id` | Public | UUID param | Returns one approved product. |
| POST | `/api/products` | Vendor | `productSchema` | Vendor creates a pending product. |
| PUT | `/api/products/:id` | Vendor owner | `productSchema` | Vendor updates own product unless it is rejected. |
| DELETE | `/api/products/:id` | Vendor owner | UUID param | Vendor deletes own product. |
| GET | `/api/vendor/products` | Vendor | none | Lists the vendor's own products. |
| GET | `/api/vendor/orders` | Vendor | none | Lists orders containing the vendor's products. |
| GET | `/api/vendor/returns` | Vendor | `page`, `limit` | Lists return requests for the vendor's products. |
| GET | `/api/vendor/income` | Vendor | none | Shows delivered-order income summary. |
| PATCH | `/api/vendor/orders/:id/status` | Vendor owner | `status`, optional `explanation` | Updates delivery status for orders containing vendor items. |
| PATCH | `/api/vendor/returns/:id/decision` | Vendor owner | `status: approved/rejected`, `reason` | Accepts or rejects a return request. |
| GET | `/api/vendors` | Public | optional `search` | Lists vendor profiles. |
| GET | `/api/vendors/:id` | Public | vendor UUID | Gets one vendor profile. |
| GET | `/api/vendors/:id/products` | Public | optional `sort` | Lists approved products for a vendor. |

Product validation rules come from `productSchema`: name min 2, description min 5, nonnegative price/stock, approved category from `shared/productCategories.mjs`, gender `Men`/`Women`/`Unisex`, at least one supported size from `shared/productSizes.mjs`, unique color names, and at least one image/video media item.

### Admin

All `/api/admin/*` routes use `authenticateUser` and `requireAdmin`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/stats` | Dashboard totals for users, vendors, products, orders, stock, returns, and revenue. |
| GET | `/api/admin/dashboard-updates` | Gets unseen dashboard section update counts. |
| PATCH | `/api/admin/dashboard-updates/:section/seen` | Marks a dashboard section as seen. |
| GET | `/api/admin/newsletter` | Newsletter admin overview. |
| GET | `/api/admin/newsletter/stats` | Newsletter counts. |
| GET | `/api/admin/newsletter/broadcasts` | Newsletter broadcast history. |
| POST | `/api/admin/newsletter/test` | Sends a test newsletter email. |
| POST | `/api/admin/newsletter/broadcast` | Sends a broadcast to active subscribers. |
| GET | `/api/admin/coupons` | Lists coupons. |
| POST | `/api/admin/coupons` | Creates a coupon. |
| PATCH | `/api/admin/coupons/:id` | Enables/disables a coupon. |
| DELETE | `/api/admin/coupons/:id` | Safely disables a coupon. |
| GET | `/api/admin/homepage-categories` | Lists homepage category shortcuts. |
| PATCH | `/api/admin/homepage-categories/visibility` | Toggles homepage category section visibility. |
| POST | `/api/admin/homepage-categories` | Creates a shortcut. |
| PATCH | `/api/admin/homepage-categories/:id` | Updates a shortcut. |
| DELETE | `/api/admin/homepage-categories/:id` | Deletes a shortcut. |
| GET | `/api/admin/orders` | Lists all orders. |
| GET | `/api/admin/products` | Lists all products regardless of status. |
| PUT | `/api/admin/products/:id` | Admin updates any product. |
| PATCH | `/api/admin/products/:id/approve` | Approves product and notifies vendor. |
| PATCH | `/api/admin/products/:id/reject` | Rejects product; requires rejection reason. |
| GET | `/api/admin/contact-messages` | Lists contact form submissions. |
| POST | `/api/admin/contact-messages/:id/conversation` | Opens/returns a conversation for a contact message. |
| GET | `/api/admin/users` | Lists users. |
| PATCH | `/api/admin/users/:id/role` | Changes role to `user`, `vendor`, or `admin`. |
| GET | `/api/admin/reviews` | Lists general reviews. |
| PATCH | `/api/admin/reviews/:id/pin` | Pins/unpins general reviews. |
| GET | `/api/admin/entity-reviews` | Lists product/vendor entity reviews. |
| DELETE | `/api/admin/entity-reviews/:type/:id` | Deletes product/vendor entity review. |
| GET | `/api/admin/wardrobe/products` | Lists products for wardrobe admin. |
| PATCH | `/api/admin/wardrobe/products/:id` | Enables wardrobe image/settings for a product. |

Confirmed limitation: `orderController.updateOrderStatus` exists but is not registered in `adminRoutes.js`. Admins can view all orders, while vendor order-status updates are routed under `/api/vendor/orders/:id/status`.

### Cart, wishlist, checkout, orders

| Method | Path | Auth | Body/params | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/cart` | User | none | Gets current user's cart. |
| POST | `/api/cart` | User | `productId`, `quantity`, optional size/color | Adds or merges a cart item after stock/status checks. |
| PUT | `/api/cart/:itemId` | User | `quantity` | Updates quantity. |
| DELETE | `/api/cart/:itemId` | User | item UUID | Removes an item. |
| GET | `/api/wishlist` | User | none | Gets current user's wishlist. |
| POST | `/api/wishlist` | User | `productId` | Adds approved product to wishlist. |
| DELETE | `/api/wishlist/:productId` | User | product UUID | Removes product from wishlist. |
| POST | `/api/orders` | User | `checkoutSchema` | Creates an order from cart, applies coupon, records payment, updates stock, clears cart. |
| GET | `/api/orders` | User | none | Lists own orders. |
| GET | `/api/orders/:id` | User owner | order UUID | Gets own order. |
| PATCH | `/api/orders/:id/cancel` | User owner | none | Cancels pending/processing own order and restores stock. |
| PATCH | `/api/orders/:id/return` | User owner | optional `reason` | Requests return for delivered order within 7 days. |
| POST | `/api/orders/coupons/validate` | User | `code` | Validates active coupon against current cart subtotal. |

Checkout supports `paymentMethod: "card"` and `"cod"`. The frontend shows `eSewa` as disabled/coming soon, and the backend validation does not accept `esewa`.

### Reviews

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/reviews` | Public | Lists general reviews/testimonials. |
| POST | `/api/reviews` | User | Creates a general review. |
| GET | `/api/product-reviews/product/:productId` | Public | Lists entity reviews for a product. |
| GET | `/api/product-reviews/product/:productId/eligibility` | User | Checks whether the user has a delivered purchase for that product. |
| POST | `/api/product-reviews/product/:productId` | User | Creates a product review if eligible. |
| PUT | `/api/product-reviews/:reviewId` | Review owner | Updates own product review. |
| DELETE | `/api/product-reviews/:reviewId` | Review owner | Deletes own product review. |
| GET | `/api/vendor-reviews/vendor/:vendorId` | Public | Lists vendor reviews. |
| POST | `/api/vendor-reviews/vendor/:vendorId` | User | Creates vendor review. |
| PUT | `/api/vendor-reviews/:reviewId` | Review owner | Updates own vendor review. |
| DELETE | `/api/vendor-reviews/:reviewId` | Review owner | Deletes own vendor review. |

Product review eligibility is enforced in `entityReviewController.js` by checking delivered orders containing the product. Vendor review purchase eligibility is not enforced in the same way.

### Messages, contact, notifications, newsletter, wardrobe

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/contact` | Public | Creates contact message. |
| GET | `/api/messages` | User | Lists visible conversations. |
| GET | `/api/messages/unread-count` | User | Gets unread conversation message count. |
| POST | `/api/messages/vendors/:vendorId` | User | Opens vendor conversation, optional product context. |
| GET | `/api/messages/:id` | Participant/admin | Gets conversation. |
| POST | `/api/messages/:id/reply` | Participant/admin | Sends reply. |
| PATCH | `/api/messages/conversations/:id/read` | Participant/admin | Marks conversation read. |
| PATCH | `/api/messages/conversations/:id/archive` | Participant/admin | Archives/unarchives conversation. |
| DELETE | `/api/messages/conversations/:id` | Participant/admin | Hides/deletes conversation for the current user. |
| GET | `/api/order-notifications` | User | Lists order/price-drop notifications. |
| PATCH | `/api/order-notifications/read-all` | User | Marks all order notifications read. |
| PATCH | `/api/order-notifications/:id/read` | User | Marks one notification read. |
| POST | `/api/newsletter/subscribe` | Public, rate limited | Subscribes an email. |
| GET | `/api/newsletter/preference` | User | Gets current user's newsletter preference. |
| PATCH | `/api/newsletter/preference` | User | Enables/disables newsletter for user email. |
| GET | `/api/newsletter/unsubscribe/:token` | Public | Unsubscribes by token. |
| POST | `/api/newsletter/unsubscribe` | Public | Unsubscribes by token in body. |
| GET | `/api/wardrobe` | User | Lists wardrobe items. |
| POST | `/api/wardrobe` | User | Adds a product to wardrobe. |
| DELETE | `/api/wardrobe/:productId` | User | Removes product from wardrobe. |
| GET | `/api/wardrobe/combos` | User | Lists outfit combos. |
| POST | `/api/wardrobe/combos` | User | Creates combo board. |
| PUT | `/api/wardrobe/combos/:comboId` | User owner | Updates combo board. |
| DELETE | `/api/wardrobe/combos/:comboId` | User owner | Deletes combo board. |
| GET | `/api/homepage-categories` | Public | Lists public active category shortcuts and visibility. |
| GET | `/api/homepage-categories/:slug` | Public | Gets one shortcut. |

## 8. Database Architecture

The schema is defined by SQL migrations in `server/migrations`. `server/scripts/migrate.js` reads all `.sql` migration files, sorts them by filename, and executes them in order. The main database helper is `server/src/config/db.js`.

### Important tables

| Table | Purpose | Important columns and constraints |
| --- | --- | --- |
| `users` | Accounts for users, vendors, and admins. | `id`, unique `email`, `password_hash`, enum `role`, vendor fields, profile image, email verification OTP fields, login lock fields, saved shipping/card summary fields, `account_suspended`. |
| `login_otps` | Login OTP challenges. | `user_id`, `otp_hash`, `expires_at`, `resend_available_at`, `attempts`, `used`. |
| `trusted_devices` | Hashed device tokens that can avoid login OTP. | unique `(user_id, device_hash)`. |
| `products` | Vendor products. | `vendor_id`, price, category, gender, sizes, size prices, colors, stock, product media, enum status `pending/approved/rejected`, rejection reason, wardrobe flags, stock-alert flags. |
| `cart_items` | Current cart rows. | `user_id`, `product_id`, selected size/color, quantity. Later migration adds unique index on `(user_id, product_id, selected_size, selected_color)`. |
| `wishlist_items` | User wishlists. | unique `(user_id, product_id)`. |
| `wardrobe_items` | Products saved to a user's wardrobe. | unique `(user_id, product_id)`. |
| `wardrobe_combos` | User outfit/combo boards. | `user_id`, `name`, JSONB `items`, optional preview image. |
| `orders` | Order header. | `user_id`, total/subtotal/shipping/discount, enum status `pending/processing/shipped/delivered/cancelled`, payment method/status, delivery info, coupon snapshot, card last4 only, return summary fields, receipt timestamps. |
| `order_items` | Snapshot of products purchased in an order. | `order_id`, nullable `product_id`, selected size/color, quantity, price at purchase, item return fields. |
| `order_item_return_requests` | Per-item return request tracking. | `order_id`, `order_item_id`, `user_id`, `vendor_id`, status `requested/approved/rejected/completed`, reasons and timestamps. |
| `order_status_history` | Timeline events for order/payment/return/refund. | `order_id`, optional `order_item_id`, actor info, status, status category, note, metadata. |
| `coupons` | Admin-created discount codes. | unique `code`, discount type `percentage/fixed`, value, enabled, creator. |
| `order_notifications` | User/vendor/admin notification records. | `user_id`, optional `order_id`, type, title, message, metadata, `read_at`. Includes `price_drop` after migration 022. |
| `product_price_drop_events` | Tracks unique product price drops to avoid duplicate notifications. | unique `(product_id, previous_price, new_price)`. |
| `contact_messages` | Public contact form submissions. | name, email, subject, message. |
| `message_conversations` | Conversation headers for contact/vendor/order contexts. | user, vendor, contact message, order, participant info, subject. |
| `conversation_messages` | Individual messages. | conversation, sender, role, body, media URL/type, read flags. |
| `conversation_deletions` / `conversation_archives` | Per-user hidden/archive state. | conversation/user composite keys. |
| `reviews` | General reviews/testimonials. | user, body, optional rating, pinned. |
| `product_reviews` | Reviews attached to products. | unique `(user_id, product_id)`, rating 1-5. |
| `vendor_reviews` | Reviews attached to vendors. | unique `(user_id, vendor_id)`, rating 1-5. |
| `newsletter_subscribers` | Newsletter subscription records. | email, active flag, unsubscribe token. |
| `newsletter_broadcasts` | Broadcast history. | subject, heading, message, CTA, counts, status. |
| `app_settings` | Application settings. | currently stores homepage category visibility. |
| `homepage_category_shortcuts` | Admin-managed home category shortcuts. | unique `slug`, icon URL, unique mapped category, active flag, order. |
| `home_collection_products` | Older gender collection mapping. | collection key `Men/Women/Unisex`, product, updater. |
| `dashboard_section_seen` | Dashboard section seen markers. | primary key `(user_id, section_key)`. |

### Relationships

```mermaid
erDiagram
    USERS ||--o{ PRODUCTS : owns
    USERS ||--o{ CART_ITEMS : has
    USERS ||--o{ WISHLIST_ITEMS : saves
    USERS ||--o{ WARDROBE_ITEMS : saves
    USERS ||--o{ WARDROBE_COMBOS : creates
    USERS ||--o{ ORDERS : places
    USERS ||--o{ PRODUCT_REVIEWS : writes
    USERS ||--o{ VENDOR_REVIEWS : writes
    USERS ||--o{ MESSAGE_CONVERSATIONS : participates
    USERS ||--o{ ORDER_NOTIFICATIONS : receives
    PRODUCTS ||--o{ CART_ITEMS : appears_in
    PRODUCTS ||--o{ WISHLIST_ITEMS : appears_in
    PRODUCTS ||--o{ WARDROBE_ITEMS : appears_in
    PRODUCTS ||--o{ ORDER_ITEMS : purchased_as
    PRODUCTS ||--o{ PRODUCT_REVIEWS : reviewed_by
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ ORDER_NOTIFICATIONS : creates
    ORDERS ||--o{ ORDER_STATUS_HISTORY : records
    ORDER_ITEMS ||--o| ORDER_ITEM_RETURN_REQUESTS : may_have
    ORDER_ITEMS ||--o{ ORDER_STATUS_HISTORY : records
    COUPONS ||--o{ ORDERS : discounts
    MESSAGE_CONVERSATIONS ||--o{ CONVERSATION_MESSAGES : contains
    CONTACT_MESSAGES ||--o| MESSAGE_CONVERSATIONS : opens
```

Orders are divided into `orders` and `order_items` because an order has shared information such as customer, delivery address, payment, discount, and status, while each item has its own product, size/color, quantity, purchase price, vendor, and return state. This is important because product price/name/stock can change later, but order history must preserve what was purchased.

Products connect to vendors through `products.vendor_id -> users.id`. Reviews, wishlists, carts, wardrobe, and order items connect users/products through join tables. Status values are stored using PostgreSQL enums for user/product/order role/status where originally defined, and text `CHECK` constraints for payment, return, notification, newsletter, and history categories.

Transactions are used for stock-sensitive flows such as cart add/update and order creation/cancellation/returns through `withTransaction()`. This keeps stock changes, order rows, cart clearing, and timeline rows consistent if an error occurs.

## 9. Authentication and Authorization

Authentication answers "Who is this user?" Authorization answers "What is this user allowed to do?"

### Registration and email verification

`POST /api/auth/register` validates `registerSchema`, lowercases the email, checks uniqueness, hashes the password with bcrypt, creates a normal `user` account with `email_verified = false`, creates a 6-digit OTP, hashes the OTP with bcrypt, stores the hash and expiry on the user row, and sends the OTP through `sendVerificationEmail()`.

The OTP expires after 10 minutes. Verification happens through `POST /api/auth/verify-email`, which compares the submitted OTP with the stored bcrypt hash, rejects expired or over-attempted codes, and clears OTP fields after success.

Public registration does not create vendor or admin accounts. Vendor/admin roles can come from seed data or an admin changing a user's role through `/api/admin/users/:id/role`.

### Login and login OTP

`POST /api/auth/login` validates email/password and a frontend-generated `deviceToken`. For non-`@example.com` accounts, the controller enforces:

- email must be verified,
- account must not be suspended,
- failed login count and lockout after 5 failures,
- login OTP for admins, untrusted devices, or suspicious login history.

When OTP is needed, `login_otps` stores a bcrypt hash of the OTP. `POST /api/auth/login/verify-otp` verifies it, marks it used, stores the device hash in `trusted_devices`, and returns the JWT and serialized user.

Development seed accounts ending in `@example.com` bypass login OTP/security friction in `authController.bypassLoginSecurity()` so demos are easier.

### JWT and protected requests

`authController.signToken()` signs `{ id, role }` with `JWT_SECRET` and a 7-day expiry. The frontend stores it in localStorage as `vastra_token`, and stores the serialized user as `vastra_user`.

Protected request flow:

```text
User logs in
-> Credentials are validated
-> Login OTP occurs if required
-> JWT is generated
-> AuthContext stores token in localStorage
-> api/client.js sends Authorization: Bearer <token>
-> authenticateUser verifies the token
-> Backend loads the user from PostgreSQL
-> Account suspension is checked
-> req.user is attached
-> requireRole/requireAdmin checks authorization
-> Controller runs or request is rejected
```

Logout is frontend-only: `AuthContext.logout()` removes `vastra_token` and `vastra_user` from localStorage. There is no server-side refresh token or token revocation table.

Socket.IO uses the same JWT. `client/src/context/MessageContext.jsx` sends the token in socket auth, and `server/src/socket.js` verifies it before joining the user to rooms.

## 10. User Roles and Permissions

| Feature | Guest | User | Vendor | Admin |
| --- | --- | --- | --- | --- |
| Browse approved products | Yes | Yes | Yes | Yes |
| View vendor profiles | Yes | Yes | Yes | Yes |
| Register/login | Yes | N/A | N/A | N/A |
| Submit contact form | Yes | Yes | Yes | Yes |
| Subscribe/unsubscribe newsletter | Yes | Yes | Yes | Yes |
| Use cart API | No | Yes | Yes, because route only requires authentication | Yes, because route only requires authentication |
| Checkout/order API | No | Yes | Yes, because route only requires authentication | Yes, because route only requires authentication |
| View own orders | No | Yes | Yes for own customer orders | Yes for own customer orders plus admin all-order view |
| Cancel own pending/processing order | No | Yes | Yes for own customer orders | Yes for own customer orders |
| Request return for own delivered order | No | Yes | Yes for own customer orders | Yes for own customer orders |
| Add products | No | No | Yes | Not via current route; `createProduct` has admin logic but route requires vendor |
| Edit/delete own products | No | No | Yes | Admin can edit via `/api/admin/products/:id`, not via vendor route |
| Approve/reject products | No | No | No | Yes |
| Update delivery status | No | No | Yes for orders containing own products | Admin status helper exists but no route is currently registered |
| Decide return requests | No | No | Yes for own product returns | No admin route currently registered for return decisions |
| Manage users/roles | No | No | No | Yes |
| Manage coupons/newsletters/homepage shortcuts/wardrobe admin | No | No | No | Yes |
| Read/respond to relevant messages | No | Yes | Yes | Yes for admin/contact conversations |

Backend role checks are in `server/src/middleware/auth.js` and route files. Frontend role checks are in `client/src/components/ProtectedRoute.jsx` and route declarations in `client/src/App.jsx`.

## 11. Main Feature Workflows

### Registration and email verification

```text
Register.jsx
-> AuthContext.register()
-> POST /api/auth/register
-> validate(registerSchema)
-> authController.register()
-> bcrypt password hash + bcrypt OTP hash
-> INSERT users with email_verified=false
-> mailer.sendVerificationEmail()
-> VerifyEmail.jsx
-> POST /api/auth/verify-email
-> bcrypt OTP compare
-> email_verified=true and OTP fields cleared
```

Failure states include duplicate verified email, SMTP configuration/delivery failure, expired OTP, invalid OTP, and too many OTP attempts.

### Login and protected access

```text
Login.jsx
-> AuthContext.login()
-> POST /api/auth/login
-> bcrypt password compare
-> optional login OTP challenge
-> AuthContext.verifyLoginOtp(), if required
-> JWT saved in localStorage
-> GET /api/auth/me on reload
-> ProtectedRoute/RoleProtectedRoute gates pages
-> API middleware verifies token for protected backend actions
```

### Vendor product creation and approval

```text
VendorDashboard/ProductForm
-> POST /api/products
-> authenticateUser + requireRole("vendor")
-> validate(productSchema)
-> productController.createProduct()
-> saveProductMedia()
-> INSERT products with status='pending'
-> AdminDashboard approval section
-> PATCH /api/admin/products/:id/approve or /reject
-> product status changes
-> vendor receives system message
-> Socket.IO emits product/dashboard/cart invalidation updates
```

Approved products become visible in public product queries. Rejected products cannot be edited by the vendor in `updateProduct()`.

### Product browsing and searching

`Shop.jsx`, `Home.jsx`, `CategoryProducts.jsx`, `ProductFilters.jsx`, `ProductGrid.jsx`, and `ProductCard.jsx` use:

- `GET /api/products` for approved product lists.
- Query filters: search, category, gender, brand, price range, purchased flag, sizes, sort.
- `GET /api/products/suggestions?q=...` for search suggestions.
- `GET /api/products/:id` for details.
- `GET /api/homepage-categories` for public home category shortcuts.

Only `products.status = 'approved'` appears in public product listings.

### Cart and checkout

```text
Product page/card
-> CartContext.addToCart()
-> POST /api/cart
-> cartController checks approved product, size/color availability, stock
-> cart_items insert/update
-> Cart.jsx collects shipping/payment/coupon details
-> POST /api/orders/coupons/validate, optional
-> CartContext.checkout()
-> POST /api/orders
-> orderController.createOrder() transaction
-> SELECT cart rows FOR UPDATE OF products
-> validate current stock, size, color
-> create orders and order_items
-> decrement product stock
-> clear cart
-> create notifications, send email, emit sockets
-> frontend navigates to order success
```

### Payment methods

Confirmed payment behavior:

- `cod`: cash on delivery, `payment_status = 'pending'` until delivery.
- `card`: dummy/test card flow, `payment_status = 'paid'` immediately.
- `esewa`: visible as "Coming soon" in `Cart.jsx`, disabled in the UI, not accepted by backend validation.

There is no real external payment processor integration. Full card number and CVV are validated for shape but not stored. Orders store cardholder name, expiry, and last four digits only.

### Order lifecycle

Order statuses come from PostgreSQL enum `order_status`: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> processing
    pending --> shipped
    pending --> delivered
    pending --> cancelled
    processing --> shipped
    processing --> delivered
    processing --> cancelled
    shipped --> delivered
    shipped --> cancelled
    delivered --> [*]
    cancelled --> [*]
```

The code does not enforce a strict step-by-step transition graph beyond preventing updates after `delivered` or `cancelled`. A vendor can set any allowed status while the order is not finalized. Users can cancel only `pending` or `processing` orders.

When a COD order is marked delivered, payment status becomes `paid` and a final receipt email is sent once. Order timeline rows are written to `order_status_history`.

### Cancellation and returns

Cancellation:

- Frontend: `Orders.jsx`
- Endpoint: `PATCH /api/orders/:id/cancel`
- Controller: `cancelOrder`
- Rules: user must own the order; order must be `pending` or `processing`; stock is restored; paid orders are marked refunded; notifications/email/socket events are attempted.

Returns:

- Frontend: `Orders.jsx` for requesting, `VendorDashboard.jsx` for vendor decisions.
- User endpoint: `PATCH /api/orders/:id/return`
- Vendor endpoints: `GET /api/vendor/returns`, `PATCH /api/vendor/returns/:id/decision`
- Rules: order must be delivered, within 7 days of delivery, and cannot already have a return request.
- Tables: `orders`, `order_items`, `order_item_return_requests`, `order_status_history`, `order_notifications`.

```mermaid
stateDiagram-v2
    [*] --> none
    none --> requested : user requests return
    requested --> approved : vendor accepts
    requested --> rejected : vendor rejects
    approved --> completed : schema supports this status
    rejected --> [*]
    completed --> [*]
```

Confirmed limitation: the schema supports `completed` return status and the timeline maps it to `product_returned`, but the current vendor decision route only validates `approved` or `rejected`.

### Reviews

Product entity reviews require a delivered purchase of the product. `entityReviewController.canReviewProduct()` checks `orders.status = 'delivered'`. Unique constraints prevent the same user reviewing the same product or vendor more than once.

General reviews in `/api/reviews` are separate and can be pinned by admins. They are not tied to a product/vendor purchase.

### Wishlist and notifications

Wishlist rows are stored in `wishlist_items`. When an approved product's effective price drops in `productController.updateProduct()`, `notifyWishlistPriceDrop()` records a `product_price_drop_events` row and creates `price_drop` order notifications for users who wishlisted the product.

Order notifications are stored in `order_notifications`, listed through `/api/order-notifications`, and pushed through Socket.IO.

### Messaging

Messages use `message_conversations` and `conversation_messages`. Users can open vendor chats, admins can open contact-message conversations, and participants can reply, mark read, archive, or hide conversations. Socket.IO pushes unread counts and message events.

### Admin and vendor dashboards

`AdminDashboard.jsx` fetches admin stats and lazily loads sections such as orders, products, users, coupons, newsletter, homepage categories, contact messages, reviews, and wardrobe products. `VendorDashboard.jsx` fetches vendor products, orders, returns, income, and dashboard updates. Dashboard "seen" state is stored in `dashboard_section_seen`.

## 12. Error Handling

Backend errors use:

- `AppError` in `server/src/utils/errors.js` for expected errors with HTTP status codes.
- `notFound()` helper for 404s.
- `asyncHandler()` to pass async controller errors to Express.
- `errorHandler()` to return `{ message }` and log 500-level errors.
- Zod validation middleware returns `400` with `{ message: "Validation failed", issues }`.

Frontend errors use:

- `getErrorMessage()` in `client/src/api/client.js`.
- Component-level error state in forms/pages.
- `NotificationContext.showNotice()` for visible notices.
- `AppErrorBoundary` for unexpected React render errors.

Common HTTP statuses used:

| Status | Meaning in this project |
| --- | --- |
| 200/201 | Successful read/update or resource creation. |
| 204 | Successful delete/no body. |
| 400 | Validation failed, invalid OTP, invalid state, invalid cart/checkout data. |
| 401 | Missing/invalid credentials or JWT. |
| 403 | Unverified email, suspended account, wrong role, ownership violation. |
| 404 | Missing route/resource or hidden unauthorized resource. |
| 409 | Duplicate email/coupon/review or invalid order/return state transition. |
| 422 | Registration email could not be delivered. |
| 429 | Login/OTP/newsletter rate or attempt limit. |
| 500 | Unexpected server/database/configuration problem. |
| 502 | Some mail delivery failure paths. |

Example error path:

```text
Cart.jsx submits checkout
-> POST /api/orders
-> checkoutSchema rejects an expired card
-> validate() returns 400 with issues
-> Axios rejects
-> getErrorMessage() extracts the message
-> page state or NotificationContext displays feedback
```

## 13. Environment Variables and Configuration

Use placeholders only. Do not commit real `.env` files.

### Server: `server/.env`

Based on `server/.env.example` and code usage:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/vastra_db
JWT_SECRET=replace-this-with-a-long-random-secret
HOST=0.0.0.0
PORT=5000
FRONTEND_PORT=5173
CLIENT_URL=http://localhost:5173
CLIENT_URLS=
SERVER_PUBLIC_URL=http://localhost:5000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=my_email@gmail.com
EMAIL_PASS=my_gmail_app_password
EMAIL_FROM="VASTRA <my_email@gmail.com>"
```

| Variable | Required | Used by | Purpose and security notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes for database features | `server/src/config/db.js` | PostgreSQL connection string. Contains credentials; keep secret. |
| `JWT_SECRET` | Yes | `server/src/server.js`, auth/socket JWT signing | Signs and verifies tokens. Must be long and secret. Server will throw if missing. |
| `HOST` | Optional | `server/src/server.js` | Bind host, defaults to `0.0.0.0`. |
| `PORT` | Optional | `server/src/server.js` | Backend port, defaults to `5000`. |
| `FRONTEND_PORT` | Optional | `server/src/app.js` | Allows localhost/private LAN frontend origins for CORS. |
| `CLIENT_URL` | Optional but recommended | `server/src/app.js`, mail unsubscribe links | Main frontend origin. |
| `CLIENT_URLS` | Optional | `server/src/app.js` | Comma-separated extra allowed origins. |
| `SERVER_PUBLIC_URL` | Optional | `server/src/utils/mailer.js` | Used when email content needs public backend/upload URLs. |
| `EMAIL_HOST` | Required for email flows | `server/src/utils/mailer.js` | SMTP host. |
| `EMAIL_PORT` | Required for email flows | `server/src/utils/mailer.js` | SMTP port. |
| `EMAIL_SECURE` | Optional | `server/src/utils/mailer.js` | `"true"` for secure SMTP. |
| `EMAIL_USER` | Required for email flows | `server/src/utils/mailer.js` | SMTP username; keep private. |
| `EMAIL_PASS` | Required for email flows | `server/src/utils/mailer.js` | SMTP password/app password; keep private. |
| `EMAIL_FROM` | Optional | `server/src/utils/mailer.js` | From address. Defaults to `EMAIL_USER`. |
| `NODE_ENV` | Optional | `authController.js` | Suppresses OTP console logging in production. |

### Client: `client/.env`

Based on `client/.env.example` and `client/vite.config.js`:

```env
VITE_API_URL=
VITE_API_PORT=5000
# VITE_DEV_BACKEND_URL=http://127.0.0.1:5000
```

| Variable | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | Optional | `client/src/api/client.js` | Full API base URL. Leave blank for Vite same-origin proxy. |
| `VITE_API_PORT` | Optional | `client/vite.config.js` | Backend port for Vite proxy. Defaults to `5000`. |
| `VITE_DEV_BACKEND_URL` | Optional | `client/vite.config.js` | Complete dev proxy target override. |

## 14. Installation and Local Development

### Required software

- Node.js compatible with Vite 6 and modern ESM.
- pnpm. The root `package.json` declares `pnpm@10.0.0`.
- PostgreSQL.
- Git.
- SMTP credentials if you want email verification/login OTP/newsletter/order emails to actually send.

### Setup

```powershell
git clone <repository-url>
cd <repository-folder>
pnpm install
```

Create server env:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server/.env` and set at least:

```env
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/vastra_db
JWT_SECRET=replace-this-with-a-long-random-secret
```

Create client env:

```powershell
Copy-Item client\.env.example client\.env
```

For normal local development, leave `VITE_API_URL=` blank so Vite proxies API requests to the backend.

Create a PostgreSQL database, for example:

```powershell
createdb vastra_db
```

Run migrations and seed data:

```powershell
pnpm migrate
pnpm seed
```

Start both servers:

```powershell
pnpm dev
```

Or start them separately:

```powershell
pnpm dev:server
pnpm dev:client
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API health: `http://localhost:5000/api/health`

Stop servers with `Ctrl+C`. If you change `.env` values, restart the relevant server because environment variables are loaded at startup.

### Development seed accounts

`server/scripts/seed.js` prints these development-only accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `Admin123!` |
| User | `user@example.com` | `User123!` |
| Vendor | `vendor@example.com` | `Vendor123!` |

Seeded `@example.com` accounts are marked email-verified and bypass login OTP/security friction for demos.

### Same-router phone testing

The existing configuration supports opening the Vite URL from another device on the same private network:

1. Run `ipconfig` and find your computer's private IPv4 address.
2. Keep `VITE_API_URL` blank.
3. Start both servers with `pnpm dev`.
4. Open `http://<your-ip>:5173` on the phone.
5. Use `http://`, not `https://`, unless you configured local certificates.

If it fails, check Windows Firewall, guest Wi-Fi isolation, router client isolation, and whether both devices are on the same subnet.

## 15. Development Commands

Root commands from `package.json`:

| Command | Purpose |
| --- | --- |
| `pnpm install` | Installs dependencies for all workspaces. |
| `pnpm dev` | Runs client and server dev scripts in parallel. |
| `pnpm dev:client` | Starts only the Vite frontend. |
| `pnpm dev:server` | Starts only the Express backend with `node --watch`. |
| `pnpm migrate` | Runs all SQL migrations in sorted order. |
| `pnpm seed` | Inserts development/demo data. |
| `pnpm transfer:export` | Runs server database export script. |
| `pnpm transfer:import` | Runs server database import script. |
| `pnpm transfer:verify` | Runs server transfer verification script. |
| `pnpm check` | Runs server syntax checks and client production build. |

Client commands from `client/package.json`:

| Command | Purpose |
| --- | --- |
| `pnpm --filter client dev` | Starts Vite dev server on all interfaces. |
| `pnpm --filter client build` | Builds the React frontend for production. |
| `pnpm --filter client preview` | Previews the built frontend. |

Server commands from `server/package.json`:

| Command | Purpose |
| --- | --- |
| `pnpm --filter server dev` | Starts API with file watching. |
| `pnpm --filter server start` | Starts API without watch mode. |
| `pnpm --filter server migrate` | Runs migrations. |
| `pnpm --filter server seed` | Seeds demo data. |
| `pnpm --filter server check` | Syntax-checks `server.js` and `app.js`. |

## 16. How to Explain the Project to Other People

### 30-second explanation

VASTRA is a fashion e-commerce web app where customers shop products, vendors upload products, and admins approve listings and manage the marketplace. It has authentication, carts, orders, returns, reviews, messages, notifications, newsletters, and dashboards.

### Two-minute explanation

VASTRA solves the problem of running a small multi-vendor clothing marketplace. The React frontend gives guests and customers a storefront with product browsing, search, wishlist, cart, checkout, orders, returns, wardrobe, and messaging. Vendors get a dashboard to upload products, track approval, manage orders, view income, and decide return requests. Admins get dashboards to approve/reject products, manage users, coupons, newsletters, homepage categories, reviews, contact messages, and wardrobe settings. The Express backend exposes REST APIs, validates inputs with Zod, protects routes with JWT and role middleware, stores data in PostgreSQL, sends emails with Nodemailer, generates receipts with PDFKit, and pushes realtime updates with Socket.IO.

### Technical explanation

The frontend starts in `client/src/main.jsx`, sets up providers for auth/cart/wishlist/messages/notifications/theme, and routes pages in `client/src/App.jsx`. API calls go through `client/src/api/client.js`, which sends requests to `/api` and attaches the JWT. The backend starts in `server/src/server.js`, builds middleware and routes in `server/src/app.js`, verifies JWTs in `middleware/auth.js`, validates bodies with `utils/validators.js`, and runs business logic in controllers. Data is stored in PostgreSQL tables created by `server/migrations`. Socket.IO provides realtime unread counts, notifications, product/order updates, and cart stock refreshes.

### Example end-to-end explanation: placing an order

```text
The user adds approved products to the React cart.
CartContext calls POST /api/cart and stores returned cart rows.
On checkout, Cart.jsx validates shipping and payment fields.
CartContext sends POST /api/orders.
JWT middleware verifies the user.
checkoutSchema validates the body.
orderController.createOrder opens a database transaction.
It locks products in the cart, validates stock/size/color, applies coupon discount, creates orders/order_items, updates product stock, and clears cart_items.
After commit, it sends notifications, emits Socket.IO updates, emails confirmation/receipt when possible, and returns the created order.
The frontend clears cart state and displays the order success page.
```

### Common questions and answers

| Question | Answer based on this repository |
| --- | --- |
| Why React? | The app has many interactive screens and shared state. React components and contexts make pages, dashboards, forms, and badges easier to compose. |
| Why Express? | Express gives a straightforward route/middleware/controller structure for the API. |
| Why PostgreSQL? | The project needs relational data: users, products, orders, order items, reviews, messages, returns, coupons, and notifications with foreign keys and constraints. |
| Why JWT? | JWT lets the frontend send a signed token with protected requests and lets HTTP and Socket.IO share the same authentication mechanism. |
| How does role-based access work? | Backend routes call `authenticateUser` and then `requireRole`/`requireAdmin`. Frontend routes use `ProtectedRoute` and `RoleProtectedRoute`. |
| How are passwords protected? | Passwords are hashed with bcrypt before storage. OTPs are also stored as bcrypt hashes. |
| How do you prevent unauthorized access? | Protected backend routes verify JWTs, fetch the current user, reject suspended accounts, enforce roles, and check resource ownership in controllers. |
| How are product approvals handled? | Vendor product creation inserts `status='pending'`. Admin approve/reject endpoints update status and message the vendor. Public listings show only approved products. |
| How is stock kept consistent? | Cart/order controllers check stock and order creation uses a transaction with product row locking before decrementing stock. |
| How does the return system work? | Users can request returns for delivered orders within 7 days. Return rows are created per order item. Vendors approve/reject requests for their own products. |
| How do frontend and backend communicate? | The frontend uses Axios REST calls to `/api` and Socket.IO for realtime updates. Vite proxies these in development. |
| What must change before production? | Configure real secrets/SMTP/origins, use production database hosting, review payment integration, secure deployment, logging, backups, tests, and token/session strategy. |
| Current limitations? | eSewa is disabled, card payment is simulated, admin order-status route is not registered, automated tests are not present, and no production deployment config is included. |

## 17. Debugging Guide

| Problem | Likely causes | Files/logs to inspect | Safe steps |
| --- | --- | --- | --- |
| Frontend cannot connect to backend | Backend not running, Vite proxy target wrong, wrong `VITE_API_PORT`, CORS issue if using custom origin. | `client/vite.config.js`, `client/.env`, `server/src/app.js`, browser network tab, backend terminal. | Visit `/api/health`; keep `VITE_API_URL` blank for local proxy; restart both servers. |
| PostgreSQL connection fails | Missing/wrong `DATABASE_URL`, database not created, PostgreSQL service stopped. | `server/.env`, `server/src/config/db.js`, backend terminal. | Test DB login, create database, rerun `pnpm migrate`. |
| Environment variables not loaded | `.env` missing or server not restarted. | `server/.env`, `client/.env`, terminal startup logs. | Copy examples, fill placeholders, restart dev server. |
| JWT missing/invalid/expired | User logged out, localStorage cleared, wrong `JWT_SECRET`, expired token. | Browser localStorage, `auth.js`, backend response. | Logout/login again; keep same `JWT_SECRET`; restart server after env change. |
| Forbidden response | Wrong role, suspended account, unverified email, ownership check failed. | Route file, `middleware/auth.js`, relevant controller. | Check logged-in user role and target resource ownership. |
| OTP email not sent | SMTP env missing/invalid, Gmail app password missing, network/email provider issue. | `server/src/utils/mailer.js`, backend logs. | Configure SMTP variables; use app password; watch for 422/500 errors. |
| Product images do not load | Upload path missing, wrong `SERVER_PUBLIC_URL` for emails, bad image URL, static `/uploads` blocked. | `server/src/app.js`, `imageUpload.js`, `client/src/api/client.js`. | Check `/uploads/...` URL in browser; verify file exists in `server/uploads`. |
| API returns 500 | Unexpected database/schema/env error. | Backend terminal, controller stack trace, migrations. | Run migrations, check required env vars, inspect SQL/table columns. |
| CORS blocks request | Custom frontend origin not allowed. | `server/src/app.js`, `CLIENT_URL`, `CLIENT_URLS`, browser console. | Add exact frontend origin to `CLIENT_URLS` or use Vite proxy. |
| Port already in use | Another process on 5173 or 5000. | Terminal error, `netstat`/task manager. | Stop old server or change `PORT`/frontend settings. |
| Database schema outdated | Migrations not run after pulling changes. | `server/migrations`, controller SQL errors. | Run `pnpm migrate`. |
| Frontend changes not appearing | Wrong dev server, stale browser cache, build preview not rebuilt. | Vite terminal, browser dev tools. | Refresh, restart Vite, rerun build before preview. |
| Package install fails | Wrong package manager, corrupted store, network issue. | `pnpm-lock.yaml`, terminal output. | Use `pnpm install`; avoid mixing npm/yarn lockfiles. |

## 18. Security Notes

### Currently implemented

- Passwords hashed with bcrypt.
- Email verification OTP and login OTP stored as bcrypt hashes.
- OTP expiry and attempt limits.
- Login lockout after repeated failures.
- JWT verification for protected HTTP routes and Socket.IO.
- Role middleware for admin/vendor-only routes.
- Account suspension check in `authenticateUser`.
- Zod validation for major request bodies.
- Parameterized SQL queries using `pg`.
- Transactions for stock/order/return operations.
- CORS origin checking for configured localhost/private LAN origins.
- Helmet security headers.
- File upload validation for image/video MIME type and size.
- Product ownership checks for vendor product/order/return actions.
- Order ownership checks for customer order access/cancel/return.
- Sensitive config expected through environment variables.
- Full card number and CVV are not stored.

### Partially implemented

- Card payment is validation and record-keeping only, not real payment processing.
- Logout is client-side token removal; there is no server token revocation.
- `@example.com` development accounts bypass login OTP/security friction.
- Some email side effects are logged if they fail after core order work succeeds.

### Recommended for production

- Use a real payment gateway and never handle raw card details directly.
- Use HTTPS everywhere and secure production CORS origins.
- Store JWTs in a hardened session strategy, or add refresh-token rotation/revocation if needed.
- Add rate limiting for auth and more public endpoints beyond newsletter subscribe.
- Add automated tests for auth, checkout, stock, role checks, returns, and admin actions.
- Add production logging, monitoring, backups, and database migration tracking.
- Review upload storage for cloud/object storage, antivirus scanning, and signed URLs.

## 19. Current Limitations and Future Improvements

### Confirmed limitations

- No automated test suite is present in the package scripts.
- eSewa is visible in the UI but disabled and not accepted by backend validation.
- Card payment is simulated; no real payment provider is integrated.
- Admin order status update helper exists but is not registered as an admin route.
- Vendor return route supports approve/reject only, although the schema includes `completed`.
- No deployment configuration was found.
- No dedicated background job queue exists for email/newsletter work.
- Refresh tokens are not implemented.
- Development seed accounts intentionally bypass some login security.

### Suggested improvements

- Add tests for critical flows: registration, login OTP, product approval, checkout, stock, coupons, returns, role authorization.
- Add migration bookkeeping so each migration runs only once in production environments.
- Add real payment integration and remove dummy card handling from production builds.
- Add admin order-status route if admins should manage delivery.
- Add a complete return-completion workflow if products are physically received back.
- Add deployment docs for frontend, backend, PostgreSQL, uploads, SMTP, and environment secrets.
- Add observability: structured logs, error reporting, uptime checks.
- Move uploaded media to object storage for production scalability.

## 20. Glossary

| Term | Meaning in VASTRA |
| --- | --- |
| API | The Express backend under `/api` that the React frontend calls. |
| Endpoint | One HTTP method and path, such as `POST /api/orders`. |
| Route | Express code that registers an endpoint and middleware, such as `orderRoutes.js`. |
| Controller | The function that performs feature logic and database queries, such as `createOrder`. |
| Middleware | Code that runs before a controller, such as JWT auth, role checks, or validation. |
| Request | Data sent from frontend/browser to backend. |
| Response | Data returned by backend to frontend, usually JSON. |
| HTTP status code | Numeric result code such as 200, 400, 401, 403, 404, 409, 500. |
| JWT | Signed token stored in localStorage and sent with protected API requests. |
| OTP | Six-digit code sent by email for registration verification or login challenge. |
| Authentication | Proving who the user is by login/token verification. |
| Authorization | Checking whether that user may perform the requested action. |
| Role-based access control | Allowing actions based on `user`, `vendor`, or `admin` roles. |
| Hashing | One-way transformation used for passwords and OTPs before database storage. |
| Database transaction | A group of SQL changes that all succeed or all roll back, used for checkout/returns. |
| Primary key | Unique row identifier, usually `id UUID`. |
| Foreign key | Link from one table to another, such as `products.vendor_id -> users.id`. |
| React component | Reusable UI function, such as `ProductCard` or `Navbar`. |
| State | Data that controls UI rendering, such as cart items or current user. |
| Hook | React function for state/effects/context, such as `useAuth()` or `useCart()`. |
| CORS | Browser security rule controlling which frontend origins can call the API. |
| Environment variable | Config value stored outside source code, such as `DATABASE_URL` or `JWT_SECRET`. |
| WebSocket/Socket.IO | Realtime channel used for unread counts, messages, order notifications, and product/order updates. |

## 21. Contributor Guide

1. Create a focused branch:

   ```powershell
   git checkout -b codex/short-feature-name
   ```

2. Make one logical change at a time. For example, keep "add coupon validation" separate from "redesign cart page."

3. For frontend changes, inspect the relevant page/component/context first. For backend changes, inspect route, validator, controller, and migration needs.

4. If the feature changes data shape, add a SQL migration in `server/migrations` and document how it relates to controllers.

5. Test locally:

   ```powershell
   pnpm check
   pnpm migrate
   pnpm dev
   ```

   Then manually test the affected workflow in the browser.

6. Write meaningful commits:

   ```powershell
   git status
   git add <changed-files>
   git commit -m "Add vendor return decision workflow"
   ```

7. Push and open a pull request:

   ```powershell
   git push -u origin codex/short-feature-name
   ```

8. Do not commit:

   - `.env` files with real secrets
   - `node_modules`
   - build output
   - local database dumps containing private data
   - uploaded private media unless intentionally part of fixtures/assets

9. Keep database changes documented in migrations and update this README when routes, roles, env vars, or workflows change.

## 22. Important Files Quick Reference

| Task | File or folder to inspect |
| --- | --- |
| Add a frontend page | `client/src/App.jsx`, `client/src/pages/` |
| Change navigation | `client/src/components/Navbar.jsx`, `client/src/components/AccountDropdown.jsx`, `client/src/components/Layout.jsx` |
| Change API base URL/token behavior | `client/src/api/client.js`, `client/vite.config.js` |
| Change login/register behavior | `client/src/context/AuthContext.jsx`, `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx`, `server/src/routes/authRoutes.js`, `server/src/controllers/authController.js` |
| Add a protected frontend route | `client/src/App.jsx`, `client/src/components/ProtectedRoute.jsx` |
| Add an API endpoint | Correct file in `server/src/routes/`, matching controller in `server/src/controllers/`, optional schema in `server/src/utils/validators.js` |
| Add role protection | `server/src/middleware/auth.js`, route file, `client/src/components/ProtectedRoute.jsx` |
| Modify database queries | Relevant controller in `server/src/controllers/`, `server/src/config/db.js` |
| Change database schema | `server/migrations/`, then `pnpm migrate` |
| Change product browsing/search | `client/src/pages/Shop.jsx`, `client/src/components/ProductFilters.jsx`, `server/src/controllers/productController.js` |
| Change product creation/approval | `client/src/components/ProductForm.jsx`, `client/src/pages/VendorDashboard.jsx`, `client/src/components/AdminProductApprovalTable.jsx`, `server/src/routes/productRoutes.js`, `server/src/routes/adminRoutes.js`, `server/src/controllers/productController.js` |
| Modify cart/checkout | `client/src/context/CartContext.jsx`, `client/src/pages/Cart.jsx`, `server/src/routes/cartRoutes.js`, `server/src/routes/orderRoutes.js`, `server/src/controllers/cartController.js`, `server/src/controllers/orderController.js` |
| Modify order logic | `server/src/controllers/orderController.js`, `server/src/routes/orderRoutes.js`, `server/src/routes/productRoutes.js`, `client/src/pages/Orders.jsx`, `client/src/components/VendorOrderTable.jsx` |
| Change returns | `server/src/controllers/orderController.js`, `client/src/pages/Orders.jsx`, `client/src/pages/VendorDashboard.jsx` |
| Change coupons | `server/src/controllers/couponController.js`, `server/src/utils/coupons.js`, `client/src/components/AdminCouponManager.jsx`, `client/src/pages/Cart.jsx` |
| Change notifications | `server/src/utils/orderNotifications.js`, `server/src/controllers/orderNotificationController.js`, `client/src/context/NotificationContext.jsx`, `client/src/components/OrderNotificationMenu.jsx` |
| Change messages/chat | `server/src/controllers/messageController.js`, `server/src/routes/messageRoutes.js`, `server/src/socket.js`, `client/src/context/MessageContext.jsx`, `client/src/pages/Messages.jsx` |
| Update email templates | `server/src/utils/mailer.js`, `server/src/utils/receiptPdf.js` |
| Change file upload rules | `server/src/utils/imageUpload.js`, `server/src/app.js`, `client/src/components/ProductForm.jsx` |
| Change newsletter | `server/src/controllers/newsletterController.js`, `server/src/routes/newsletterRoutes.js`, `client/src/components/AdminNewsletterBroadcast.jsx`, `client/src/pages/NewsletterUnsubscribe.jsx` |
| Change wardrobe | `server/src/controllers/wardrobeController.js`, `server/src/routes/wardrobeRoutes.js`, `client/src/pages/Wardrobe.jsx`, `client/src/pages/AdminWardrobe.jsx` |
| Debug CORS/proxy | `server/src/app.js`, `client/vite.config.js`, `client/src/api/client.js`, `.env` files |
