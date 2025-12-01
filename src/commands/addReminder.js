/**
 * Add Reminder Command Handler
 * Allows users to create custom reminders
 */
import { addReminder } from '../utils/dataStore.js';

// Regex patterns for time validation
const TIME_24H = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
const TIME_12H = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;
const DATE_FORMAT = /^(\d{2})-(\d{2})-(\d{4})$/;

/**
 * Parse time string to hours and minutes
 * @param {string} timeStr - Time string in 24h or 12h format
 * @returns {{hours: number, minutes: number}|null}
 */
function parseTime(timeStr) {
    const match24 = timeStr.match(TIME_24H);
    if (match24) {
        return {
            hours: parseInt(match24[1], 10),
            minutes: parseInt(match24[2], 10)
        };
    }
    
    const match12 = timeStr.match(TIME_12H);
    if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = parseInt(match12[2], 10);
        const period = match12[3].toUpperCase();
        
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }
        
        return { hours, minutes };
    }
    
    return null;
}

/**
 * Parse date string to date components
 * @param {string} dateStr - Date string in MM-DD-YYYY format
 * @returns {{month: number, day: number, year: number}|null}
 */
function parseDate(dateStr) {
    const match = dateStr.match(DATE_FORMAT);
    if (!match) return null;
    
    return {
        month: parseInt(match[1], 10),
        day: parseInt(match[2], 10),
        year: parseInt(match[3], 10)
    };
}

/**
 * Handle the add-reminder slash command
 * @param {CommandInteraction} interaction - Discord interaction
 */
export async function handleAddReminder(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || 'No description provided.';
    const reminderDate = interaction.options.getString('reminder-date');
    const reminderTime = interaction.options.getString('reminder-time');
    
    // Validate date format
    const dateParts = parseDate(reminderDate);
    if (!dateParts) {
        return interaction.reply({
            content: '❌ Invalid date format. Please use MM-DD-YYYY (e.g., 12-25-2024).',
            ephemeral: true
        });
    }
    
    // Validate time format
    const timeParts = parseTime(reminderTime);
    if (!timeParts) {
        return interaction.reply({
            content: '❌ Invalid time format. Please use HH:MM (24-hour) or HH:MM AM/PM (12-hour).',
            ephemeral: true
        });
    }
    
    // Create the reminder date/time
    const reminderDateTime = new Date(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hours,
        timeParts.minutes
    );
    
    // Validate the date is valid
    if (isNaN(reminderDateTime.getTime())) {
        return interaction.reply({
            content: '❌ Invalid date or time. Please check your inputs.',
            ephemeral: true
        });
    }
    
    // Check if the date is in the future
    if (reminderDateTime.getTime() <= Date.now()) {
        return interaction.reply({
            content: '❌ Reminder must be set for a future date and time.',
            ephemeral: true
        });
    }
    
    // Create and save the reminder
    const reminder = {
        title,
        description,
        date: reminderDateTime.toISOString(),
        userId: interaction.user.id,
        createdAt: new Date().toISOString(),
        remindersSent: []
    };
    
    try {
        await addReminder(reminder);
        
        const timestamp = Math.floor(reminderDateTime.getTime() / 1000);
        
        await interaction.reply({
            content: `✅ Reminder "${title}" set for <t:${timestamp}:F> (<t:${timestamp}:R>).`,
            ephemeral: false
        });
    } catch (error) {
        console.error('Error saving reminder:', error);
        await interaction.reply({
            content: '❌ An error occurred while saving your reminder. Please try again.',
            ephemeral: true
        });
    }
}
