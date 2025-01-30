import { getReminderEmbedColor } from "./reminders.js";
import { EmbedBuilder } from 'discord.js';
import { ROLE_ID, CHANNEL_ID} from "../../config.js";
import { saveReminders, loadReminders} from "./reminders.js";

export async function checkForCustomReminders(client) {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const date = new Date();
  const storedData = await loadReminders(); // Load custom reminders
  const storedReminders = storedData.reminders;
  for (let i = 0; i<storedReminders.length; i++) {
    const reminder = storedReminders[i];
    const reminderDate = new Date(reminder.date);
    const hoursLeft = (reminderDate - date) / (1000 * 60 * 60); // Calculate the hours left

    if (hoursLeft <= 24) {
      await sendCustomReminder(reminder, hoursLeft, channel, storedData, i);
    }
  }
}

export async function sendCustomReminder(reminder, hoursLeft, channel, storedData, i) {
  const reminderColor = getReminderEmbedColor(hoursLeft); // Get the appropriate color based on time left
  const reminders = { 168: "1 week left", 72: "3 days left", 24: "1 day left", 0: "Now"};
  const reminderKey = hoursLeft <= 0 ? 0 : hoursLeft <= 72 ? 72 : hoursLeft <= 24 ? 24 : 168;

  // Skip if the reminder has already been sent
  if (reminder.remindersSent.includes(reminderKey)) return;

  const embed = new EmbedBuilder()
    .setTitle(`Reminder: ${reminder.title}`)
    .addFields(
      { 
        name: 'Reminder Date', 
        value: `<t:${Math.floor(new Date(reminder.date).getTime() / 1000)}:F>`, 
        inline: true 
      },
      { 
        name: 'Time Left', 
        value: `<t:${Math.floor(new Date(reminder.date).getTime() / 1000)}:R>` || 'N/A', 
        inline: true 
      },
      { 
        name: 'Description', 
        value: reminder.description || 'No description provided.', 
        inline: true 
      }
    )
    .setTimestamp()
    .setColor(reminderColor);

  try {
    // Send the reminder
    await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
    console.log(`Reminder sent: ${reminders[reminderKey]} for reminder "${reminder.title}"`);
    if (reminderKey == 0) {
      await storedData.reminders.pop(i);
    }
    else {
      storedData.reminders[i].remindersSent.push(reminderKey);
    }
    await saveReminders(storedData);
  } catch (error) {
    console.error(`Failed to send reminder for ${reminder.title}:`, error);
  }
}

