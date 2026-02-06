import { connection } from '../src/config';

async function main() {
    try {
        let slot = await connection.getSlot();

        // Try last 10 slots
        for (let i = 0; i < 10; i++) {
            try {
                const block = await connection.getBlock(slot - i, { maxSupportedTransactionVersion: 0 });
                if (block && block.transactions.length > 0) {
                    const tx = block.transactions[0];
                    const accountKeys = tx.transaction.message.getAccountKeys();
                    const payer = accountKeys.get(0)!.toString();
                    console.log(`FOUND_WALLET:${payer}`);
                    process.exit(0);
                }
            } catch (e) {
                // Ignore missing blocks
            }
        }
        console.error('Could not find a valid block in last 10 slots');
        process.exit(1);
    } catch (e: any) {
        console.error(e.message);
        process.exit(1);
    }
}

main();
