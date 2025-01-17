import { loadReminders, saveReminders } from '../utils/reminders.js';
export async function handleAddReminder(interaction){
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || 'No description provided.';
    const reminderDate = interaction.options.getString('reminder-date');
    const reminderTime = interaction.options.getString('reminder-time');

    // Validate the date format (MM-DD-YYYY)
    if (!/^\d{2}-\d{2}-\d{4}$/.test(reminderDate)) {
        return await interaction.reply({
            content: 'Invalid date format. Please use MM-DD-YYYY.',
            flags: 64
        });
    }

    // Validate the time format (24-hour or 12-hour with AM/PM)
    const time24HourFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/; // Matches 24-hour format
    const time12HourFormat = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i; // Matches 12-hour format

    if (!time24HourFormat.test(reminderTime) && !time12HourFormat.test(reminderTime)) {
        return await interaction.reply({
            content: 'Invalid time format. Please use HH:MM (24-hour) or HH:MM AM/PM (12-hour).',
            flags: 64
        });
    }

    // Parse date and time into a JavaScript Date object
    const [month, day, year] = reminderDate.split('-').map(Number);
    let hours, minutes;

    if (time24HourFormat.test(reminderTime)) {
        [hours, minutes] = reminderTime.split(':').map(Number);
    } else if (time12HourFormat.test(reminderTime)) {
        const [time, period] = reminderTime.split(/\s+/); // Split into time and AM/PM
        [hours, minutes] = time.split(':').map(Number);
        if (period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12; // Convert PM to 24-hour
        }
        if (period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0; // Convert 12 AM to 0 hours
        }
    }

    const reminderDateTime = new Date(year, month - 1, day, hours, minutes);

    // Check if the parsed date is valid
    if (isNaN(reminderDateTime.getTime())) {
        return await interaction.reply({
            content: 'Invalid date or time provided. Please check your inputs.',
            flags: 64
        });
    }
    const testTime = new Date()
    if (reminderDateTime.getTime() <= testTime.getTime()){
        return await interaction.reply({
            content: 'Invalid date or time provided. Please check your inputs.',
            flags: 64
        });
    }

    // Save the reminder to a file or database (example uses JSON file)
    const reminder = {
        title,
        description,
        date: reminderDateTime.toISOString(),
        userId: interaction.user.id,
        remindersSent: []
    };
    try {
        let data = await loadReminders();
        // rewrite to just call a save function
        data.reminders.push(reminder);
        await saveReminders(data)
        await interaction.reply({
        content: `Reminder "${title}" set for ${reminderDateTime.toLocaleString()}.`
        });
    } catch (error) {
        console.error('Error saving reminder:', error);
        await interaction.reply({
            content: 'An error occurred while saving your reminder. Please try again later.',
            flags: 64
        });
    }
}