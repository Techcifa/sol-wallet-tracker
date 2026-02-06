import dotenv from 'dotenv';
dotenv.config();

import { getDb } from './core/database';
import { StateManager } from './core/state';
import { WalletMonitor } from './core/monitor';
import { TransactionFetcher } from './core/fetcher';
import { Parser } from './core/parser';
import { PublicKey } from '@solana/web3.js';
import { TelegramBot, WalletController } from './integrations/telegram';

async function main() {
    console.log('🚀 Starting Solana Wallet Tracker...');

    // 1. Start Health Check Server (IMMEDIATE START for Render Port Binding)
    const http = require('http');
    const PORT = process.env.PORT || 3000;
    console.log(`[Health] Starting server on port ${PORT}...`);

    const server = http.createServer((req: any, res: any) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Solana Wallet Tracker is Running');
    });

    server.on('error', (err: any) => {
        console.error(`[Health] Server error:`, err);
    });

    server.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`[Health] Listening on ${PORT}`);
    });

    // 2. Initialize DB & State
    const db = await getDb();
    console.log('✅ Database connected');

    // 2b. Self-Ping Strategy (Prevent Free Tier Sleep)
    const APP_URL = process.env.APP_URL;
    if (APP_URL) {
        console.log(`[KeepAlive] Activated for ${APP_URL}`);
        setInterval(() => {
            http.get(APP_URL, (res: any) => {
                // console.log(`[KeepAlive] Ping status: ${res.statusCode}`);
            }).on('error', (err: any) => {
                console.error(`[KeepAlive] Failed: ${err.message}`);
            });
        }, 5 * 60 * 1000); // Ping every 5 minutes
    }

    // 3. Define Controller (Forward declaration for Monitor)
    let monitor: WalletMonitor;

    const controller: WalletController = {
        addWallet: async (address: string, label: string) => {
            new PublicKey(address); // Validate
            await db.run(
                'INSERT OR REPLACE INTO monitored_wallets (address, label, added_at) VALUES (?, ?, ?)',
                address, label, Date.now()
            );
            if (monitor) await monitor.addWallet(address);
            console.log(`[Controller] Added ${address}`);
        },
        removeWallet: async (address: string) => {
            await db.run('DELETE FROM monitored_wallets WHERE address = ?', address);
            if (monitor) await monitor.removeWallet(address);
            console.log(`[Controller] Removed ${address}`);
        },
        listWallets: async () => {
            return await db.all('SELECT address, label FROM monitored_wallets');
        }
    };

    // 4. Initialize Integrations
    const bot = new TelegramBot(controller);
    bot.launch().then(() => console.log('✅ Telegram Bot launched')).catch(e => console.error(e));

    // 5. Define Pipeline
    const processTransaction = async (signature: string, slot: number) => {
        // A. Fetch
        const tx = await TransactionFetcher.fetchWithRetry(signature);
        if (!tx) {
            console.warn(`[Pipeline] Failed to fetch ${signature}, skipping.`);
            return;
        }

        // B. Identify which monitored wallet is involved
        // In a sophisticated system we pass this context down, but here we can re-derive it
        // or iterate through our monitored list. 
        // Optimization: The Monitor knows which wallet triggered it. 
        // For now, let's find the wallet from the transaction account keys that matches our DB.
        // This is a slight inefficiency but safe.

        const monitoredWallets = await db.all('SELECT address FROM monitored_wallets');
        const walletSet = new Set(monitoredWallets.map(w => w.address));

        // Find the intersection
        let targetWallet = '';
        const accountKeys = tx.transaction.message.accountKeys.map(k => k.pubkey.toString());
        for (const key of accountKeys) {
            if (walletSet.has(key)) {
                targetWallet = key;
                break; // Handle first match
            }
        }

        if (!targetWallet) {
            return; // Should not happen if monitor is working correctly
        }

        // C. Parse & Classify
        const activity = Parser.parseTransaction(tx, targetWallet);
        if (!activity) {
            // console.log(`[Pipeline] No relevant activity detected for ${signature}`);
            // DEBUG: Logging why it was dropped
            if (process.env.DEBUG) console.log(`[Pipeline] Dropped ${signature} (No Activity/Unclassified)`);
            return;
        }

        console.log(`[Pipeline] Activity Detected: ${activity.type} for ${activity.wallet}`);

        // D. Alert
        await bot.sendAlert(activity);
    };

    // 6. Start Monitor
    monitor = new WalletMonitor(processTransaction);

    // Load initial wallets
    const wallets = await db.all('SELECT address FROM monitored_wallets');
    if (wallets.length > 0) {
        await monitor.startMonitoring(wallets.map(w => w.address));
    } else {
        console.warn('⚠️ No wallets found in database. Use the CLI to add wallets.');
    }

    // Keep alive
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await monitor.stop();
        await db.close();
        process.exit(0);
    });
}

main().catch(console.error);
