/**
 * Canvas Notifier Discord Bot
 * Main entry point
 * 
 * Monitors Canvas LMS for assignments and sends notifications to Discord.
 * Creates assignment-specific roles for targeted reminders.
 * Supports automatic course discovery from Canvas.
 * Supports custom reminders via slash commands.
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { DISCORD_TOKEN, TIMING, validateConfig, AUTO_DISCOVER } from './config.js';
import { ensureDataFile } from './src/utils/dataStore.js';
import { 
    checkForNewAssignments, 
    initializeCoursesFromCanvas,
    startCourseRefreshLoop 
} from './src/services/assignmentService.js';
import { startReminderLoop } from './src/services/reminderService.js';
import { handleInteraction } from './src/handlers/interactionHandler.js';
import { handleRoleUpdate } from './src/handlers/roleUpdateHandler.js';
import log from './src/utils/logger.js';

// Validate configuration before starting
log.section('CONFIGURATION');
if (!validateConfig()) {
    log.error('Configuration validation failed. Please check your .env file.');
    process.exit(1);
}
log.info('Configuration validated successfully');

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
    log.section('DISCORD CONNECTION');
    log.info(`Logged in as ${client.user.tag}`);
    log.info(`User ID: ${client.user.id}`);
    log.info(`Connected to ${client.guilds.cache.size} guild(s)`);
    
    try {
        // Initialize courses from Canvas (auto-discovery mode)
        if (AUTO_DISCOVER) {
            log.section('CANVAS COURSE DISCOVERY');
            log.info('Auto-discovery mode enabled');
            log.info('Initializing courses from Canvas...');
            const success = await initializeCoursesFromCanvas(client);
            if (!success) {
                log.error('Failed to initialize courses from Canvas');
            } else {
                log.info('Course initialization complete');
            }
        }
        
        // Ensure data files exist
        log.section('DATA INITIALIZATION');
        await ensureDataFile();
        log.info('Data files initialized');
        
        // Initial assignment check
        log.section('INITIAL ASSIGNMENT CHECK');
        log.info('Running initial assignment check...');
        await checkForNewAssignments(client);
        log.info('Initial assignment check completed');
        
        // Start reminder loop
        log.section('REMINDER SYSTEM');
        await startReminderLoop(client);
        
        // Start course refresh loop (auto-discovery mode)
        if (AUTO_DISCOVER) {
            startCourseRefreshLoop(client);
        }
        
        // Schedule periodic assignment checks
        setInterval(async () => {
            try {
                log.debug('Checking for new assignments...');
                await checkForNewAssignments(client);
                log.debug('Assignment check completed');
            } catch (error) {
                log.error('Error during assignment check', error);
            }
        }, TIMING.assignmentCheckInterval);
        
        log.info(`Assignment check scheduled (interval: ${TIMING.assignmentCheckInterval / 60000} minutes)`);
        
        log.section('BOT READY');
        log.info('Canvas Notifier Bot is now running!');
        
    } catch (error) {
        log.error('Error during initialization', error);
    }
});

// Handle interactions (slash commands, autocomplete, buttons)
client.on('interactionCreate', handleInteraction);

// Handle role updates (sync assignment roles when course roles change)
client.on('guildMemberUpdate', handleRoleUpdate);

// Error handling
client.on('error', (error) => {
    log.error('Discord client error', error);
});

process.on('unhandledRejection', (error) => {
    log.error('Unhandled promise rejection', error);
});

process.on('SIGINT', () => {
    log.info('Shutting down...');
    client.destroy();
    process.exit(0);
});

// Login to Discord
log.section('STARTUP');
log.info('Connecting to Discord...');
client.login(DISCORD_TOKEN);
