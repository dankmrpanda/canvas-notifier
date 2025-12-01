/**
 * Ping Toggle Command Handler
 * Allows users to enable/disable personal ping notifications
 */
import { addUser, removeUser } from '../utils/dataStore.js';

/**
 * Handle the ping toggle slash command
 * @param {CommandInteraction} interaction - Discord interaction
 */
export async function handlePingCommand(interaction) {
    const toggle = interaction.options.getBoolean('toggle');
    const userId = interaction.user.id;
    
    try {
        if (toggle) {
            // Enable pings
            const added = await addUser(userId);
            
            if (added) {
                await interaction.reply({
                    content: '✅ Pings enabled! You will now receive personal notifications.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'ℹ️ Pings are already enabled for you.',
                    ephemeral: true
                });
            }
        } else {
            // Disable pings
            const removed = await removeUser(userId);
            
            if (removed) {
                await interaction.reply({
                    content: '✅ Pings disabled. You will no longer receive personal notifications.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'ℹ️ Pings are already disabled for you.',
                    ephemeral: true
                });
            }
        }
    } catch (error) {
        console.error('Error updating ping preference:', error);
        await interaction.reply({
            content: '❌ An error occurred while updating your preferences. Please try again.',
            ephemeral: true
        });
    }
}
