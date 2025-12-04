/**
 * Slash Command Registration
 * Registers all bot commands with Discord
 * 
 * Run with: node src/commands/registerCommands.js
 */
import { REST, Routes, ApplicationCommandOptionType } from 'discord.js';
import { DISCORD_TOKEN, CLIENT_ID, validateConfig } from '../../config.js';

// Command definitions
const commands = [
    {
        name: 'assignments',
        description: 'View your pending assignments and mark them as done/undone'
    },
    {
        name: 'ping',
        description: 'Enable or disable personal ping notifications',
        options: [
            {
                name: 'toggle',
                description: 'Enable (true) or disable (false) pings',
                type: ApplicationCommandOptionType.Boolean,
                required: true
            }
        ]
    },
    {
        name: 'add-reminder',
        description: 'Create a custom reminder',
        options: [
            {
                name: 'title',
                description: 'Title of the reminder',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 100
            },
            {
                name: 'reminder-date',
                description: 'Date for the reminder (MM-DD-YYYY)',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'reminder-time',
                description: 'Time for the reminder (HH:MM or HH:MM AM/PM)',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'description',
                description: 'Optional description for the reminder',
                type: ApplicationCommandOptionType.String,
                required: false,
                max_length: 1000
            }
        ]
    },
    {
        name: 'delete-reminder',
        description: 'Delete one of your reminders',
        options: [
            {
                name: 'reminder',
                description: 'Select the reminder to delete',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            }
        ]
    }
];

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
    // Validate configuration
    if (!validateConfig()) {
        console.error('Configuration validation failed. Please check your .env file.');
        process.exit(1);
    }
    
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    try {
        console.log('🔄 Registering slash commands...');
        console.log(`   Commands: ${commands.map(c => c.name).join(', ')}`);
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
        process.exit(1);
    }
}

// Run if executed directly (not imported)
// Handle both Unix and Windows paths
const scriptPath = process.argv[1]?.replace(/\\/g, '/');
const moduleUrl = import.meta.url.replace(/^file:\/\/\/?/, '');
const isMainModule = scriptPath && moduleUrl.endsWith(scriptPath.split('/').pop());
if (isMainModule) {
    registerCommands();
}

export { commands, registerCommands };
