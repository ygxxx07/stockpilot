# StockPilot Admin + Shopkeeper update

## What this update does
- Adds `role` (`admin` or `shopkeeper`) and `status` (`active` or `suspended`) to existing PostgreSQL users with non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements.
- Public registration always creates a shopkeeper. The role is never accepted from the request body.
- Promotes the account whose email matches the backend environment variable `ADMIN_EMAIL` to admin when the API starts.
- Adds admin-only overview and shop status endpoints.
- Adds an admin dashboard; shopkeeper users continue to see the existing inventory UI.
- Uses `VITE_API_URL` from the frontend environment and defaults to the existing API.

## Before deploying
1. Keep the current website running until the new deployment is verified.
2. Do not delete or recreate the Render PostgreSQL database.
3. In Render, open `stockpilot-api` -> Environment and add `ADMIN_EMAIL` with the email address of the account you already own and want to be admin. Do not put a password here.
4. Commit/push the updated source to the same GitHub `main` branch connected to Render. The API will deploy and add the two columns without dropping existing users/products.
5. Open `stockpilot-web` -> Environment and set `VITE_API_URL` to `https://stockpilot-api-rwxk.onrender.com/api` (exactly once, no trailing slash), then deploy the frontend.
6. Sign out and sign in again with the account matching `ADMIN_EMAIL`. If the current session does not show the role, signing out/in refreshes it.

## Important notes
- Do not use a public signup to create an admin. Set `ADMIN_EMAIL` only in the backend service environment.
- Do not set `ADMIN_EMAIL` to an email address you do not control.
- The migration preserves existing users and products. It does not reset the database.
- This environment could syntax-check the Node backend, but could not complete `npm ci` / a local frontend production build because dependency installation timed out. Check Render build/deploy logs before considering it live.
- The free Render database expiry date shown in the dashboard was November 28, 2026. Arrange a database export or plan change before that date.
