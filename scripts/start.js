/**
 * Startup Script
 * Registers slash commands and then starts the bot
 */
import { REST, Routes } from 'discord.js';
import { DISCORD_TOKEN, CLIENT_ID, validateConfig, COURSES } from '../config.js';
import { commands } from '../src/commands/registerCommands.js';

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    try {
        console.log('🔄 Registering slash commands...');
        console.log(`   Commands: ${commands.map(c => c.name).join(', ')}`);
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Slash commands registered successfully!');
        return true;
    } catch (error) {
        console.error('❌ Failed to register commands:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Canvas Notifier Bot Starting...\n');
    
    // Validate configuration
    if (!validateConfig()) {
        console.error('❌ Configuration validation failed. Please check your .env file.');
        process.exit(1);
    }
    
    // Register slash commands
    const registered = await registerCommands();
    if (!registered) {
        console.error('⚠️ Command registration failed, but continuing to start bot...');
    }
    
    console.log('\n🔄 Starting bot...\n');
    
    // Import and run the main bot
    await import('../index.js');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
