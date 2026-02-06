import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';

dotenv.config();

export const CONFIG = {
    RPC_URL: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
    WS_URL: process.env.WS_URL, // Optional, usually derived from RPC_URL
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
    // Default to confirmed as per design
    COMMITMENT: 'confirmed' as const,
};

// Singleton connection instance
export const connection = new Connection(CONFIG.RPC_URL, {
    commitment: CONFIG.COMMITMENT,
    wsEndpoint: CONFIG.WS_URL,
});
