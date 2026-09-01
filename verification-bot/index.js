const { Client, GatewayIntentBits, Events } = require('discord.js');

const required = ['DISCORD_VERIFICATION_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`FXC Verification Bot online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verification-status') return;
  await interaction.reply({ content: '✅ FXC Verification Bot is online.', ephemeral: true });
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error.message);
});

client.login(process.env.DISCORD_VERIFICATION_BOT_TOKEN);
