import { MetadataFetcher } from './src/core/metadata';

async function test() {
    console.log('Testing MetadataFetcher...');

    // Test USDC
    console.log('Fetching USDC info...');
    const usdc = await MetadataFetcher.getTokenInfo('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    console.log('USDC:', usdc);

    // Test POPCAT (or some other token)
    console.log('Fetching POPCAT info...');
    const popcat = await MetadataFetcher.getTokenInfo('7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr');
    console.log('POPCAT:', popcat);
}

test();
