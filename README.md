# StockPilot — Inventory Management System

A separately branded inventory-management application based on the supplied NEXSTOCK source project.

## Separation guarantees
- This folder is a new project copy. It does not modify the original NEXSTOCK repository.
- Frontend API defaults to `http://localhost:3000/api`; the original NEXSTOCK API URL has been removed.
- Browser token key is `stockpilot_token`, separate from `nexstock_token`.
- Configure a brand-new PostgreSQL database and new Render services. Never paste the original NEXSTOCK `DATABASE_URL`.
- Push this folder to the other student's GitHub account as a new repository.

## Stack
React + Vite frontend; Node.js + Express API; PostgreSQL database; token-based authentication; administrator and shopkeeper roles.

## Local setup
1. Create a new empty PostgreSQL database named `stockpilot`.
2. Copy `.env.example` to `.env` and set the new database URL, a new JWT secret, and the other student's admin email.
3. Install backend dependencies with `npm install` and start with `npm start` (check root package scripts).
4. In `client/`, run `npm install`; copy `client/.env.example` to `client/.env`; then run `npm run dev`.
5. Confirm the frontend calls only the new API and that the new database contains no data from NEXSTOCK.

## Deployment
Create a new GitHub repository under the other student's account. Create a new Render PostgreSQL database, new backend web service and new frontend static site. Configure:
- Backend: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `PGSSLMODE=require`
- Frontend: `VITE_API_URL=https://<new-backend-host>/api`
Do not reuse any NEXSTOCK service, database, secrets, or environment variables.

## Branding
Product name: StockPilot
Visual direction: midnight navy, electric cyan and indigo; distinct split-panel authentication and dark operations dashboard.

## Important verification
Run registration, login, product CRUD, shop-level data isolation, admin overview and account-status tests against the new database before demonstration. Replace any remaining project-specific wording in source comments or documentation if needed.
