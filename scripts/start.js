/**
 * Startup Script
 * Registers slash commands and then starts the bot
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { REST, Routes } from 'discord.js';
import { DISCORD_TOKEN, CLIENT_ID, validateConfig } from '../config.js';
import { commands } from '../src/commands/registerCommands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensure required directories exist at runtime
 * This handles Docker volume mounts that may override build-time directories
 */
function ensureDirectories() {
    const dirs = [
        path.resolve(__dirname, '../logs'),
        path.resolve(__dirname, '../courses')
    ];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    }
}

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
    
    // Ensure required directories exist (handles Docker volume mounts)
    ensureDirectories();
    
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
