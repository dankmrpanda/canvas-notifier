/**
 * Canvas Notifier Discord Bot
 * Main entry point
 * 
 * Monitors Canvas LMS for assignments and sends notifications to Discord.
 * Creates assignment-specific roles for targeted reminders.
 * Supports custom reminders via slash commands.
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { DISCORD_TOKEN, TIMING, validateConfig } from './config.js';
import { ensureDataFile } from './src/utils/dataStore.js';
import { checkForNewAssignments } from './src/services/assignmentService.js';
import { startReminderLoop } from './src/services/reminderService.js';
import { handleInteraction } from './src/handlers/interactionHandler.js';

// Validate configuration before starting
if (!validateConfig()) {
    console.error('❌ Configuration validation failed. Please check your .env file.');
    process.exit(1);
}

// Create Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,  // Required for fetching members with roles
        GatewayIntentBits.GuildMessages  // Required for message context
    ]
});

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`   Guilds: ${client.guilds.cache.size}`);
    
    try {
        // Ensure data file exists
        await ensureDataFile();
        console.log('✅ Data file initialized');
        
        // Initial assignment check
        console.log('🔄 Running initial assignment check...');
        await checkForNewAssignments(client);
        console.log('✅ Initial assignment check completed');
        
        // Start reminder loop
        await startReminderLoop(client);
        
        // Schedule periodic assignment checks
        setInterval(async () => {
            try {
                console.log('🔄 Checking for new assignments...');
                await checkForNewAssignments(client);
                console.log('✅ Assignment check completed');
            } catch (error) {
                console.error('❌ Error during assignment check:', error);
            }
        }, TIMING.assignmentCheckInterval);
        
        console.log(`✅ Assignment check scheduled (interval: ${TIMING.assignmentCheckInterval / 60000} minutes)`);
        console.log('🚀 Bot is ready!');
        
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
});

// Handle interactions (slash commands, autocomplete, buttons)
client.on('interactionCreate', handleInteraction);

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    client.destroy();
    process.exit(0);
});

// Login to Discord
client.login(DISCORD_TOKEN);
