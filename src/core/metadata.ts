import { CONFIG } from '../config';

interface TokenInfo {
    name: string;
    symbol: string;
    logo?: string;
    price?: number;
    marketCap?: number;
}

const CACHE = new Map<string, TokenInfo>();

export const MetadataFetcher = {
    async getTokenInfo(mint: string): Promise<TokenInfo | null> {
        if (mint === 'SOL') return { name: 'Solana', symbol: 'SOL' };

        // Cache layer (Basic)
        // Note: For price we might want shorter cache or no cache, 
        // but for name/symbol it's fine. 
        // Let's not cache price here for now or update it frequently.
        // For simplicity we fetch fresh for now.

        try {
            // 1. Fetch Metadata (Helius/RPC) - Optional if DexScreener has it
            // 2. Fetch Price/MC (DexScreener)
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
            const data: any = await response.json();

            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0]; // Best pair usually first
                const info: TokenInfo = {
                    name: pair.baseToken.name,
                    symbol: pair.baseToken.symbol,
                    logo: pair.info?.imageUrl,
                    price: parseFloat(pair.priceUsd),
                    marketCap: pair.fdv || pair.marketCap
                };
                return info;
            }
        } catch (error) {
            console.error(`[Metadata] Failed for ${mint}:`, error);
        }

        // Fallback
        return { name: 'Unknown Token', symbol: 'TOKEN' };
    }
};
