const { Client, GatewayIntentBits, Events } = require('discord.js');

const required = [
  'DISCORD_VERIFICATION_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'FXC_BACKEND_URL',
  'CRON_SECRET',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const backendUrl = process.env.FXC_BACKEND_URL.replace(/\/$/, '');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function reconcileEntitlements() {
  try {
    const response = await fetch(`${backendUrl}/api/maintenance/entitlements`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || `HTTP ${response.status}`);
    }

    console.log(`Entitlement reconciliation complete: matched=${body.matchedCount || 0}, expired=${body.modifiedCount || 0}`);
  } catch (error) {
    console.error('Entitlement reconciliation failed:', error.message);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`FXC Verification Bot online as ${readyClient.user.tag}`);
  await reconcileEntitlements();

  // While the PC is online, keep expiry cleanup reasonably fresh too.
  setInterval(reconcileEntitlements, 15 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verification-status') return;
  await interaction.reply({ content: '✅ FXC Verification Bot is online.', ephemeral: true });
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error.message);
});

client.login(process.env.DISCORD_VERIFICATION_BOT_TOKEN);
