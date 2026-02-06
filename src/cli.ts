import { getDb, closeDb } from './core/database';
import { PublicKey } from '@solana/web3.js';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const address = args[1];
    const label = args[2] || 'Wallet';

    const db = await getDb();

    try {
        if (command === 'add') {
            if (!address) throw new Error('Address required');
            new PublicKey(address); // Validate

            await db.run(
                'INSERT OR REPLACE INTO monitored_wallets (address, label, added_at) VALUES (?, ?, ?)',
                address, label, Date.now()
            );
            console.log(`✅ Added ${address} (${label})`);

        } else if (command === 'remove') {
            if (!address) throw new Error('Address required');
            await db.run('DELETE FROM monitored_wallets WHERE address = ?', address);
            console.log(`🗑 Removed ${address}`);

        } else if (command === 'list') {
            const rows = await db.all('SELECT * FROM monitored_wallets');
            console.table(rows);

        } else {
            console.log(`
Usage:
  npm run cli add <address> [label]
  npm run cli remove <address>
  npm run cli list
      `);
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await closeDb();
    }
}

main();
