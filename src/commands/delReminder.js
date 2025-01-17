import fs from 'fs/promises';
import { dataFilePath } from '../../config.js';
import { loadReminders } from '../utils/reminders.js';

export async function delReminderAutocomplete(interaction) {
    console.log("Processing autocomplete...");
    try {
      const data = await loadReminders();
      const reminders = data.reminders;
      // console.log(reminders);
      if (!Array.isArray(reminders)) {
        console.error('Reminders data is not an array:', reminders);
        await interaction.respond([]); // Respond with an empty array to avoid errors
        return;
      }
      
      // Map all reminders to choices for autocomplete
      const choices = reminders.map((reminder, index) => ({
        name: `${reminder.title} - ${new Date(reminder.date).toLocaleString()}`,
        value: String(index), // Use the index as the value for simplicity
      }));
      // console.log(choices);
      // Respond with up to 25 choices (Discord's limit)
      await interaction.respond(choices.slice(0, 25));
    } catch (error) {
      console.error('Error handling autocomplete:', error);
      await interaction.respond([]); // Send an empty response if an error occurs
    }
}

export async function handleDelReminder(interaction) {
    try {
      let data = await loadReminders()

      // Get the reminder index from the interaction
      const reminderIndex = interaction.options.getString('reminder');

      // Validate input: ensure it's an index from autocomplete
      if (!reminderIndex || isNaN(reminderIndex) || parseInt(reminderIndex, 10) < 0 || parseInt(reminderIndex, 10) >= data.reminders.length) {
        return await interaction.reply({
          content: 'Invalid input. Please select a valid reminder from the autocomplete options.',
          flags: 64 // Ephemeral message to notify the user without cluttering the channel
        });
      }

      // Remove the selected reminder
      const index = parseInt(reminderIndex, 10);
      const reminderToDelete = data.reminders[index];
      data.reminders.splice(index, 1); // Remove the reminder by index

      // Save the updated data back to the JSON file
      await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));

      await interaction.reply({
        content: `Reminder "${reminderToDelete.title}" scheduled for ${new Date(
          reminderToDelete.date
        ).toLocaleString()} has been deleted.`,
      });
    } catch (error) {
      console.error('Error deleting reminder:', error);
      await interaction.reply({
        content: 'An error occurred while deleting the reminder. Please try again later.',
        flags: 64
      });
    }
}