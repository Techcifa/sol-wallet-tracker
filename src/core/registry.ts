export const PROGRAM_IDS = {
    JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy745kF3NMtK7hc2K5cTEms',
    RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    RAYDIUM_AMM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Same as V4 usually referenced
    ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    METEORA_DLMM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
    TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    SYSTEM_PROGRAM: '11111111111111111111111111111111',
    ASSOCIATED_TOKEN_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
};

export const KNOWN_PROGRAMS = new Map<string, string>([
    [PROGRAM_IDS.JUPITER_V6, 'Jupiter'],
    [PROGRAM_IDS.RAYDIUM_V4, 'Raydium'],
    [PROGRAM_IDS.ORCA_WHIRLPOOL, 'Orca'],
    [PROGRAM_IDS.PUMP_FUN, 'Pump.fun'],
    [PROGRAM_IDS.METEORA_DLMM, 'Meteora'],
    [PROGRAM_IDS.TOKEN_PROGRAM, 'Token Program'],
    [PROGRAM_IDS.SYSTEM_PROGRAM, 'System Program'],
    [PROGRAM_IDS.ASSOCIATED_TOKEN_PROGRAM, 'ATA Program'],
]);

export function getProgramName(programId: string): string {
    return KNOWN_PROGRAMS.get(programId) || 'Unknown';
}
