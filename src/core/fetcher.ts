import { ParsedTransactionWithMeta, Connection } from '@solana/web3.js';
import { connection, CONFIG } from '../config';

const MAX_RETRIES = 5;
const BASE_DELAY = 500;

export const TransactionFetcher = {
    async fetchWithRetry(signature: string): Promise<ParsedTransactionWithMeta | null> {
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                const tx = await connection.getParsedTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: CONFIG.COMMITMENT
                });

                if (tx) {
                    return tx;
                }

                // If tx is null, it might be an eventual consistency issue, wait and retry
                // But if we got it from logsSubscribe, it should be there. 
                // We'll treat null as a retryable error for a short period.
                console.warn(`[Fetcher] Tx ${signature} not found, attempt ${attempt + 1}`);

            } catch (error: any) {
                if (error.message?.includes('429')) {
                    console.warn(`[Fetcher] Rate limit hit for ${signature}, backing off...`);
                } else {
                    console.error(`[Fetcher] Error fetching ${signature}:`, error.message);
                }
            }

            attempt++;
            await new Promise(resolve => setTimeout(resolve, BASE_DELAY * Math.pow(2, attempt)));
        }

        console.error(`[Fetcher] Failed to fetch ${signature} after ${MAX_RETRIES} attempts`);
        return null;
    }
};
