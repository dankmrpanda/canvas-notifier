/**
 * Delete Reminder Command Handler
 * Allows users to delete their custom reminders
 */
import { getReminders, removeReminder } from '../utils/dataStore.js';

/**
 * Handle autocomplete for the delete-reminder command
 * @param {AutocompleteInteraction} interaction - Discord autocomplete interaction
 */
export async function delReminderAutocomplete(interaction) {
    try {
        const reminders = await getReminders();
        
        if (!Array.isArray(reminders) || reminders.length === 0) {
            return interaction.respond([]);
        }
        
        // Filter to show only the user's reminders (optional: remove filter to show all)
        const userReminders = reminders
            .map((reminder, index) => ({
                reminder,
                index
            }))
            .filter(({ reminder }) => reminder.userId === interaction.user.id);
        
        // Format choices for autocomplete
        const choices = userReminders.map(({ reminder, index }) => {
            const date = new Date(reminder.date);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Truncate title if too long (Discord limit is 100 chars for name)
            const displayTitle = reminder.title.length > 50 
                ? reminder.title.substring(0, 47) + '...'
                : reminder.title;
            
            return {
                name: `${displayTitle} - ${dateStr}`,
                value: String(index)
            };
        });
        
        // Discord limits to 25 choices
        await interaction.respond(choices.slice(0, 25));
    } catch (error) {
        console.error('Error handling autocomplete:', error);
        await interaction.respond([]);
    }
}

/**
 * Handle the delete-reminder slash command
 * @param {CommandInteraction} interaction - Discord interaction
 */
export async function handleDelReminder(interaction) {
    try {
        const reminderIndexStr = interaction.options.getString('reminder');
        const reminderIndex = parseInt(reminderIndexStr, 10);
        
        // Validate input
        if (isNaN(reminderIndex) || reminderIndex < 0) {
            return interaction.reply({
                content: '❌ Invalid selection. Please choose a reminder from the autocomplete list.',
                ephemeral: true
            });
        }
        
        const reminders = await getReminders();
        
        // Check if index is valid
        if (reminderIndex >= reminders.length) {
            return interaction.reply({
                content: '❌ Reminder not found. It may have already been deleted.',
                ephemeral: true
            });
        }
        
        const reminderToDelete = reminders[reminderIndex];
        
        // Optional: Check if user owns the reminder
        if (reminderToDelete.userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ You can only delete your own reminders.',
                ephemeral: true
            });
        }
        
        // Delete the reminder
        await removeReminder(reminderIndex);
        
        const timestamp = Math.floor(new Date(reminderToDelete.date).getTime() / 1000);
        
        await interaction.reply({
            content: `✅ Deleted reminder "${reminderToDelete.title}" (was scheduled for <t:${timestamp}:F>).`,
            ephemeral: false
        });
    } catch (error) {
        console.error('Error deleting reminder:', error);
        await interaction.reply({
            content: '❌ An error occurred while deleting the reminder. Please try again.',
            ephemeral: true
        });
    }
}
