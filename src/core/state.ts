import { getDb } from './database';

const TX_CACHE_SIZE = 10000;
const processedTxCache = new Set<string>();

// Pre-load cache if needed or just start empty (clean slate approach acceptable for single-run, 
// but for restart we rely on DB)

export const StateManager = {
    async isTransactionProcessed(signature: string): Promise<boolean> {
        if (processedTxCache.has(signature)) return true;

        const db = await getDb();
        const result = await db.get('SELECT signature FROM processed_txs WHERE signature = ?', signature);

        if (result) {
            // Hydrate cache
            processedTxCache.add(signature);
            if (processedTxCache.size > TX_CACHE_SIZE) {
                // Simple eviction: clear 10% or just oldest (Set order is insertion order)
                const iterator = processedTxCache.values();
                const val = iterator.next().value;
                if (val) processedTxCache.delete(val);
            }
            return true;
        }

        return false;
    },

    async markTransactionProcessed(signature: string, slot: number): Promise<void> {
        processedTxCache.add(signature);
        const db = await getDb();
        try {
            await db.run(
                'INSERT INTO processed_txs (signature, slot, processed_at) VALUES (?, ?, ?)',
                signature, slot, Date.now()
            );
        } catch (e: any) {
            if (e.code === 'SQLITE_CONSTRAINT') {
                // Already processed, ignore
                return;
            }
            console.error('Failed to mark tx as processed', e);
            // Don't throw, we want to continue but strictly this is a risk. 
            // Ideally we retry DB writes.
        }
    },

    async getLastProcessedSlot(): Promise<number> {
        const db = await getDb();
        const res = await db.get('SELECT value FROM system_state WHERE key = ?', 'last_processed_slot');
        return res ? parseInt(res.value, 10) : 0;
    },

    async updateLastProcessedSlot(slot: number): Promise<void> {
        const db = await getDb();
        await db.run(
            'INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)',
            'last_processed_slot', slot.toString(), Date.now()
        );
    }
};
