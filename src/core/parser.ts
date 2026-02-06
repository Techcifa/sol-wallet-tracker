import { ParsedTransactionWithMeta, PublicKey, ParsedInstruction } from '@solana/web3.js';
import { getProgramName, PROGRAM_IDS } from './registry';

export interface TokenBalanceChange {
    mint: string;
    amount: number;
    decimals: number;
    uiAmount: number;
}

export interface Activity {
    type: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER' | 'UNKNOWN';
    signature: string;
    slot: number;
    timestamp: number;
    wallet: string;
    sourceToken?: TokenBalanceChange; // Que Salió
    destToken?: TokenBalanceChange; // Que Entró
    program?: string;
    fee: number;
}

export const Parser = {
    parseTransaction(tx: ParsedTransactionWithMeta, targetWallet: string): Activity | null {
        if (!tx.meta || !tx.transaction) return null;

        const signature = tx.transaction.signatures[0];
        const slot = tx.slot;
        const timestamp = tx.blockTime || 0;
        const fee = tx.meta.fee / 1e9; // Lamports to SOL

        // 1. Identify Program
        let program = 'Unknown';
        const instructions = tx.transaction.message.instructions;
        for (const ix of instructions) {
            if ('programId' in ix) {
                const pid = ix.programId.toString();
                const name = getProgramName(pid);
                if (name !== 'Unknown' && name !== 'System Program' && name !== 'Token Program') {
                    program = name;
                    break; // Prioritize the first "Interesting" program (DeFi)
                }
            }
        }

        // 2. Calculate Balance Diffs for Target Wallet
        const accountIndex = tx.transaction.message.accountKeys.findIndex(k => k.pubkey.toString() === targetWallet);
        if (accountIndex === -1) {
            // Target wallet not in transaction keys? Should not happen if confirmed via generic means, 
            // but if it's an inner instruction transfer it might appear differently?
            // Actually accountKeys always contains all accounts involved.
            return null;
        }

        // SOL Changes
        const preSol = tx.meta.preBalances[accountIndex];
        const postSol = tx.meta.postBalances[accountIndex];
        const solDiff = (postSol - preSol) / 1e9;

        // Adjusted SOL diff (removing fee if payer)
        // Note: If targetWallet IS the payer, the fee creates a negative diff. 
        // We strictly care about the swap amount. 
        // Usually Payer is first account.
        const isPayer = (accountIndex === 0);
        const solChange = isPayer ? solDiff + fee : solDiff;

        // Token Changes
        // We need to match preTokenBalances and postTokenBalances for our owner.
        // The meta.pre/postTokenBalances array contains ownership info.
        const changes: TokenBalanceChange[] = [];

        const preTokens = tx.meta.preTokenBalances?.filter(b => b.owner === targetWallet) || [];
        const postTokens = tx.meta.postTokenBalances?.filter(b => b.owner === targetWallet) || [];

        // Map of Mint -> Amount
        const tokenMap = new Map<string, { pre: number, post: number, decimals: number }>();

        preTokens.forEach(t => {
            const current = tokenMap.get(t.mint) || { pre: 0, post: 0, decimals: t.uiTokenAmount.decimals };
            current.pre = t.uiTokenAmount.uiAmount || 0;
            tokenMap.set(t.mint, current);
        });

        postTokens.forEach(t => {
            const current = tokenMap.get(t.mint) || { pre: 0, post: 0, decimals: t.uiTokenAmount.decimals };
            current.post = t.uiTokenAmount.uiAmount || 0;
            tokenMap.set(t.mint, current);
        });

        tokenMap.forEach((val, mint) => {
            const diff = val.post - val.pre;
            if (Math.abs(diff) > 0) {
                changes.push({
                    mint,
                    amount: diff,
                    decimals: val.decimals,
                    uiAmount: diff
                });
            }
        });

        // 3. Classify Activity

        // Case A: Simple SOL Transfer
        if (changes.length === 0) {
            if (Math.abs(solChange) > 0.001) { // Threshold for noise
                return {
                    type: 'TRANSFER',
                    signature, slot, timestamp, wallet: targetWallet,
                    sourceToken: { mint: 'SOL', amount: solChange, decimals: 9, uiAmount: solChange },
                    program, fee
                };
            }
            return null; // Just distinct fee structure or failed interaction noise?
        }

        // Case B: Swap / Buy / Sell

        // Heuristic:
        // Buy: SOL decreases, Token increases
        // Sell: Token decreases, SOL increases
        // Swap: Token A decreases, Token B increases

        let solTokenChange = null;
        if (Math.abs(solChange) > 0.001) { // Significant SOL movement
            solTokenChange = { mint: 'SOL', amount: solChange, decimals: 9, uiAmount: solChange };
        }

        const increasedTokens = changes.filter(c => c.amount > 0);
        const decreasedTokens = changes.filter(c => c.amount < 0);

        // BUY: Lost SOL, Gained Token
        if (solChange < -0.001 && increasedTokens.length > 0) {
            return {
                type: 'BUY',
                signature, slot, timestamp, wallet: targetWallet,
                sourceToken: { mint: 'SOL', amount: Math.abs(solChange), decimals: 9, uiAmount: Math.abs(solChange) }, // Spent
                destToken: increasedTokens[0], // Received (Primary)
                program, fee
            };
        }

        // SELL: Gained SOL, Lost Token
        if (solChange > 0.001 && decreasedTokens.length > 0) {
            return {
                type: 'SELL',
                signature, slot, timestamp, wallet: targetWallet,
                sourceToken: decreasedTokens[0], // Sold
                destToken: { mint: 'SOL', amount: solChange, decimals: 9, uiAmount: solChange }, // Received
                program, fee
            };
        }

        // SWAP: Lost Token A, Gained Token B
        if (decreasedTokens.length > 0 && increasedTokens.length > 0) {
            return {
                type: 'SWAP',
                signature, slot, timestamp, wallet: targetWallet,
                sourceToken: decreasedTokens[0],
                destToken: increasedTokens[0],
                program, fee
            };
        }

        // Transfer (Token)
        if (increasedTokens.length > 0 && decreasedTokens.length === 0 && Math.abs(solChange) < 0.01) {
            return {
                type: 'TRANSFER',
                signature, slot, timestamp, wallet: targetWallet,
                destToken: increasedTokens[0], // Received
                program, fee
            };
        }
        if (decreasedTokens.length > 0 && increasedTokens.length === 0 && Math.abs(solChange) < 0.01) {
            return {
                type: 'TRANSFER',
                signature, slot, timestamp, wallet: targetWallet,
                sourceToken: decreasedTokens[0], // Sent
                program, fee
            };
        }


        return {
            type: 'UNKNOWN',
            signature, slot, timestamp, wallet: targetWallet,
            program, fee
        };
    }
};
