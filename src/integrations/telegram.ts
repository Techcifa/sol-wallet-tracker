import { Telegraf, Context } from 'telegraf';
import { CONFIG } from '../config';
import { Activity } from '../core/parser';
import { MetadataFetcher } from '../core/metadata';

export interface WalletController {
    addWallet: (address: string, label: string) => Promise<void>;
    removeWallet: (address: string) => Promise<void>;
    listWallets: () => Promise<{ address: string, label: string }[]>;
}

export class TelegramBot {
    private bot: Telegraf;
    private chatId: string;
    private controller?: WalletController;

    constructor(controller?: WalletController) {
        this.bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
        this.chatId = CONFIG.TELEGRAM_CHAT_ID;
        this.controller = controller;

        this.setupCommands();

        this.bot.catch((err: any, ctx: Context) => {
            console.error(`[Telegram] Error for ${ctx.updateType}`, err);
        });
    }

    private setupCommands() {
        // Middleware for Auth
        this.bot.use(async (ctx, next) => {
            if (ctx.chat?.id.toString() !== this.chatId) {
                console.warn(`[Telegram] Unauthorized access attempt from ${ctx.chat?.id}`);
                return; // Ignore unauthorized
            }
            await next();
        });

        this.bot.command('start', (ctx) => {
            ctx.reply(`
👋 <b>SolTracker Terminal</b>

Use these commands to manage your wallet watchlist:

➕ <b>Track:</b> <code>/add &lt;address&gt; [label]</code>
➖ <b>Untrack:</b> <code>/remove &lt;address&gt;</code>
📋 <b>List:</b> <code>/list</code>

<i>Alerts include links to Photon, BullX, and DexScreener.</i>
`, { parse_mode: 'HTML' });
        });

        this.bot.command('add', async (ctx) => {
            if (!this.controller) return ctx.reply('❌ Controller not initialized');
            const args = ctx.message.text.split(' ').slice(1);
            if (args.length < 1) return ctx.reply('⚠️ Usage: /add <address> [label]');

            const address = args[0];
            const label = args.slice(1).join(' ') || 'Wallet';

            try {
                await this.controller.addWallet(address, label);
                ctx.reply(`✅ Monitoring <code>${address}</code> (${label})`, { parse_mode: 'HTML' });
            } catch (e: any) {
                ctx.reply(`❌ Error: ${e.message}`);
            }
        });

        this.bot.command('remove', async (ctx) => {
            if (!this.controller) return ctx.reply('❌ Controller not initialized');
            const args = ctx.message.text.split(' ').slice(1);
            if (args.length < 1) return ctx.reply('⚠️ Usage: /remove <address>');

            try {
                await this.controller.removeWallet(args[0]);
                ctx.reply(`🗑 Removed ${args[0]}`);
            } catch (e: any) {
                ctx.reply(`❌ Error: ${e.message}`);
            }
        });

        this.bot.command('list', async (ctx) => {
            if (!this.controller) return;
            const wallets = await this.controller.listWallets();
            if (wallets.length === 0) return ctx.reply('📭 No wallets monitored.');

            const msg = wallets.map(w => `• <code>${w.address}</code> (${w.label})`).join('\n');
            ctx.reply(msg, { parse_mode: 'HTML' });
        });
    }

    async launch() {
        process.once('SIGINT', () => this.bot.stop('SIGINT'));

        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

        await this.bot.launch(() => {
            console.log('[Telegram] Bot started');
            if (this.chatId) {
                this.bot.telegram.sendMessage(this.chatId, '🟢 **Wallet Tracker System Online**', { parse_mode: 'Markdown' });
            }
        });
    }

    async sendAlert(activity: Activity) {
        if (!this.chatId) {
            console.warn('[Telegram] No Chat ID configured, skipping alert');
            return;
        }

        // Fetch Metadata
        const enrich = async (token?: { mint: string, uiAmount: number }) => {
            if (!token) return undefined;
            if (token.mint === 'SOL') return { ...token, symbol: 'SOL', name: 'Solana' };
            const info = await MetadataFetcher.getTokenInfo(token.mint);
            return { ...token, ...info };
        };

        const source = await enrich(activity.sourceToken);
        const dest = await enrich(activity.destToken);

        const message = this.formatMessage(activity, source, dest);
        try {
            await this.bot.telegram.sendMessage(this.chatId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true }
            });
            console.log(`[Telegram] Alert sent for ${activity.signature}`);
        } catch (error) {
            console.error(`[Telegram] Failed to send alert:`, error);
        }
    }

    private formatMessage(act: Activity, source?: any, dest?: any): string {
        const explorerLink = `https://solscan.io/tx/${act.signature}`;
        const shorten = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;
        const wallet = `<code>${shorten(act.wallet)}</code>`;
        const time = new Date(act.timestamp * 1000).toLocaleTimeString();

        // Helper to formatting token info
        const formatToken = (t?: any) => {
            if (!t) return 'Unknown';
            const symbol = t.symbol || 'TOKEN';
            const name = t.name || '';
            const mintLine = t.mint === 'SOL' ? '' : `\n🔑 <b>CA:</b> <code>${t.mint}</code>`;
            const nameLine = name && name !== 'Unknown' ? ` (${name})` : '';

            // Add MC if available
            let statsLine = '';
            if (t.marketCap) {
                const mc = t.marketCap >= 1_000_000
                    ? `$${(t.marketCap / 1_000_000).toFixed(1)}M`
                    : `$${(t.marketCap / 1_000).toFixed(1)}K`;
                const price = t.price ? ` @ $${t.price.toFixed(6)}` : '';
                statsLine = `\n📊 <b>MC:</b> ${mc}${price}`;
            }

            return `<b>${t.uiAmount.toFixed(4)} ${symbol}${nameLine}</b>${statsLine}${mintLine}`;
        };

        let icon = 'ℹ️';
        let actionLine = '';
        let displayToken: { mint: string, uiAmount: number } | undefined;

        switch (act.type) {
            case 'BUY':
                icon = '🟢';
                displayToken = act.destToken;
                actionLine = `
💸 <b>Spent:</b> ${formatToken(source)}
💰 <b>Bought:</b> ${formatToken(dest)}
`;
                break;
            case 'SELL':
                icon = '🔴';
                displayToken = act.sourceToken;
                actionLine = `
💰 <b>Sold:</b> ${formatToken(source)}
💸 <b>Received:</b> ${formatToken(dest)}
`;
                break;
            case 'SWAP':
                icon = '🔄';
                displayToken = act.destToken;
                actionLine = `
🔻 <b>Swap Out:</b> ${formatToken(source)}
Pm <b>Swap In:</b> ${formatToken(dest)}
`;
                break;
            case 'TRANSFER':
                icon = '💸';
                // For transfer we might only have one token
                if (act.destToken) {
                    displayToken = act.destToken;
                    actionLine = `📥 <b>Received:</b> ${formatToken(dest)}`;
                } else {
                    displayToken = act.sourceToken;
                    actionLine = `📤 <b>Sent:</b> ${formatToken(source)}`;
                }
                break;
        }

        return `
${icon} <b>${act.type} DETECTED</b>
👤 ${wallet} | ⏰ ${time}
${actionLine}
🛠 <b>Pool/Program:</b> ${act.program || 'Unknown'}

🔍 <b>Links:</b>
<a href="https://solscan.io/tx/${act.signature}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${displayToken?.mint}">Photon</a> | <a href="https://dexscreener.com/solana/${displayToken?.mint}">DexScreener</a> | <a href="https://bullx.io/terminal?chainId=1399811149&address=${displayToken?.mint}">BullX</a>
`.trim();
    }
}
