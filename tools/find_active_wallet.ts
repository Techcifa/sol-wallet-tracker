import { connection } from '../src/config';

async function main() {
    try {
        const slot = await connection.getSlot();
        const block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });

        if (block && block.transactions.length > 0) {
            // Just take the first one
            const tx = block.transactions[0];

            // Handle VersionedTransaction
            const accountKeys = tx.transaction.message.getAccountKeys();
            const payer = accountKeys.get(0)!.toString();

            console.log(payer);
        } else {
            console.error('No transactions found in recent block');
        }
    } catch (e: any) {
        console.error(e.message);
    }
}

main();
