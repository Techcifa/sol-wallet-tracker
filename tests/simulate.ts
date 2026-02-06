import { Parser } from '../src/core/parser';
import { ParsedTransactionWithMeta } from '@solana/web3.js';

// Mock Data
const MOCK_WALLET = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5wF7swW';
const MOCK_TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

const mockTx: any = {
    slot: 12345,
    blockTime: Math.floor(Date.now() / 1000),
    transaction: {
        signatures: ['5Z7s2...mock...signature'],
        message: {
            accountKeys: [
                { pubkey: { toString: () => MOCK_WALLET } }, // Payer/Owner
                // ... others
            ],
            instructions: [
                {
                    programId: { toString: () => 'JUP6LkbZbjS1jKKwapdHNy745kF3NMtK7hc2K5cTEms' } // Jupiter
                }
            ]
        }
    },
    meta: {
        fee: 5000,
        preBalances: [1000000000], // 1 SOL
        postBalances: [500000000], // 0.5 SOL (Spent 0.5)
        preTokenBalances: [
            {
                owner: MOCK_WALLET,
                mint: MOCK_TOKEN_MINT,
                uiTokenAmount: { uiAmount: 0, decimals: 6 }
            }
        ],
        postTokenBalances: [
            {
                owner: MOCK_WALLET,
                mint: MOCK_TOKEN_MINT,
                uiTokenAmount: { uiAmount: 50, decimals: 6 } // Gained 50 USDC
            }
        ]
    }
};

console.log('Running Simulation...');
const result = Parser.parseTransaction(mockTx as ParsedTransactionWithMeta, MOCK_WALLET);

console.log('Result:', JSON.stringify(result, null, 2));

if (result?.type === 'BUY' && result.program === 'Jupiter') {
    console.log('✅ TEST PASSED: Detected Buy via Jupiter');
} else {
    console.error('❌ TEST FAILED');
}
