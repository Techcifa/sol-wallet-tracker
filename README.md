# Solana Wallet Tracker

A Telegram bot that monitors specific Solana wallets for transactions and sends real-time alerts.

## Features

- **Real-time Monitoring**: Tracks transactions for specified Solana addresses.
- **Telegram Integration**: Sends alerts directly to a Telegram chat.
- **Persistent Storage**: Uses SQLite to store monitored wallets and local state.
- **Deployment Ready**: Configured for deployment on platforms like Render.

## Prerequisites

- Node.js (v18 or higher)
- npm
- A Telegram Bot Token (from @BotFather)
- A Solana RPC URL (e.g., from Helius, QuickNode, or Alchemy)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd Connect-Wallet-tracker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Create a `.env` file in the root directory based on `.env.example`:

```env
# Solana Configuration
RPC_URL=https://api.mainnet-beta.solana.com
WS_URL=wss://api.mainnet-beta.solana.com

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Database
DB_PATH=tracker.sqlite

# System
PORT=3000
DEBUG=true
```

## Usage

### Development

Run the bot in development mode (hot-reloading):

```bash
npm run dev
```

### Production

Build and run the production version:

```bash
npm run build
npm start
```

### CLI Tools

The project includes CLI tools for managing wallets:

```bash
npm run cli
```

## Deployment (Render)

This project is configured for deployment on Render.

1.  **Connect GitHub**: Connect your repository to Render.
2.  **Create Web Service**: Select "Web Service" as the service type.
3.  **Encironment Variables**: Add the variables from your `.env` file to the Render dashboard.
4.  **Start Command**: `npm start`
5.  **Build Command**: `npm install && npm run build`

The application includes a health check server ensuring the deployment stays active.
