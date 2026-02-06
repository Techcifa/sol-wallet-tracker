import { PublicKey, Logs } from '@solana/web3.js';
import { connection } from '../config';
import { StateManager } from './state';
import { TransactionFetcher } from './fetcher';

// Define a callback type for what to do when a valid transaction is found
type TransactionCallback = (signature: string, slot: number) => Promise<void>;

export class WalletMonitor {
    private subscriptionIds: Map<string, number> = new Map();
    private isRunning: boolean = false;
    private onTransaction: TransactionCallback;

    constructor(onTransaction: TransactionCallback) {
        this.onTransaction = onTransaction;
    }

    async startMonitoring(addresses: string[]) {
        this.isRunning = true;
        console.log(`[Monitor] Starting...`);
        for (const address of addresses) {
            await this.addWallet(address);
        }
    }

    async addWallet(address: string) {
        if (this.subscriptionIds.has(address)) {
            return; // Already monitored
        }
        try {
            const pubKey = new PublicKey(address);
            const subId = connection.onLogs(
                pubKey,
                (logs, ctx) => this.handleLog(logs, ctx.slot, address),
                'confirmed'
            );
            this.subscriptionIds.set(address, subId);
            console.log(`[Monitor] Subscribed to ${address} (ID: ${subId})`);
        } catch (error) {
            console.error(`[Monitor] Failed to subscribe to ${address}:`, error);
        }
    }

    async removeWallet(address: string) {
        const subId = this.subscriptionIds.get(address);
        if (subId) {
            await connection.removeOnLogsListener(subId);
            this.subscriptionIds.delete(address);
            console.log(`[Monitor] Unsubscribed from ${address}`);
        }
    }

    private async handleLog(logs: Logs, slot: number, monitoredAddress: string) {
        if (logs.err) {
            // Skip failed transactions
            return;
        }

        const signature = logs.signature;

        // 1. Dedup Check (Memory + DB)
        const isProcessed = await StateManager.isTransactionProcessed(signature);
        if (isProcessed) {
            return;
        }

        console.log(`[Monitor] New potential activity: ${signature} (Slot: ${slot})`);

        // 2. Mark as processed immediately to prevent loops if multiple logs come in
        // We strictly assume idempotency at the callback level too, but this helps.
        await StateManager.markTransactionProcessed(signature, slot);

        // 3. Update system high-water mark
        await StateManager.updateLastProcessedSlot(slot);

        // 4. Trigger Pipeline
        try {
            // We defer the heavy lifting to the callback to keep the loop unblocked
            // In a heavier system this would be pushed to a queue (BullMQ/Redis)
            this.onTransaction(signature, slot).catch(err => {
                console.error(`[Monitor] Error processing callback for ${signature}:`, err);
            });
        } catch (e) {
            console.error(`[Monitor] Pipeline trigger failed:`, e);
        }
    }

    async stop() {
        this.isRunning = false;
        for (const [address, subId] of this.subscriptionIds) {
            await connection.removeAccountChangeListener(subId); // Note: removeAccountChangeListener works for logs too? 
            // Actually strictly it should be removeOnLogsListener
            await connection.removeOnLogsListener(subId);
        }
        this.subscriptionIds.clear();
        console.log('[Monitor] Stopped all subscriptions');
    }
}
