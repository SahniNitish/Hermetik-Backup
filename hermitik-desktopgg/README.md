# Hermetik Dashboard

This repository contains Node.js services used for tracking cryptocurrency wallet data.

There are two Express based backends under `backend/` and `hermetik-backend/`. Each
service connects to MongoDB and exposes REST API endpoints.

## Requirements

- Node.js (18+ recommended)
- MongoDB database

## Setup

1. Install dependencies for each service:
   ```bash
   cd backend && npm install
   cd ../hermetik-backend && npm install
   ```
2. Create an `.env` file in each service directory with the following variables:
   - `MONGO_URI` – MongoDB connection string
   - `PORT` – port to run the server (optional)
   - `JWT_SECRET` – secret key for authentication (only for `backend`)
   - `DEBANK_API_KEY` – API key for DeBank wallet data (only for `backend`)
   - `COINGECKO_API_KEY` – API key for price data (only for `backend`)
3. Start the development server:
   ```bash
   npm run dev
   ```

## API Overview

### Authentication (`backend`)
- `POST /api/auth/signup` – create user
- `POST /api/auth/login` – obtain JWT token

### Wallet routes (`backend`)
- `POST /api/wallet/add-wallet` – associate a wallet address to the user
- `GET /api/wallet/fetch` – fetch token balances and store them

### Wallet routes (`hermetik-backend`)
- `GET /api/wallets/:address` – fetch wallet data from DeBank
- `GET /api/wallets` – list tracked wallets
- `DELETE /api/wallets/:address` – remove a tracked wallet

Each route returns JSON and most interactions require a valid MongoDB setup.

## Development

Use `nodemon` (`npm run dev`) for automatic restarts during development.

Feel free to open issues or pull requests if you encounter problems.

