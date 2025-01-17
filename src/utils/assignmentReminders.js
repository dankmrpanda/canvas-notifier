import { CHANNEL_ID } from "../../config.js";
import { loadAssignments, saveAssignments } from "./assignments.js";
import { getReminderEmbedColor } from './reminders.js'
import { EmbedBuilder } from 'discord.js';

export async function checkForReminders(client) {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const date = new Date();
  const storedData = await loadAssignments();
  const storedAssignments = storedData.assignments;
  for (let i = 0; i<storedAssignments.length; i++) {
    const assignment = storedAssignments[i];
    const dueDate = new Date(assignment.deadline);
    const hoursLeft = (dueDate - date) / (1000 * 60 * 60);

    if (hoursLeft <= 24 && hoursLeft >= 0) {
      await sendReminder(assignment, hoursLeft, channel, storedData, i);
    }
  }
}

export async function sendReminder(assignment, hoursLeft, channel, storedData, i) {
  const reminderColor = getReminderEmbedColor(hoursLeft);
  const reminders = { 24: "1 day left", 6: "6 hours left", 3: "3 hours left", 0.5: "30 minutes left" };
  const reminderKey = hoursLeft <= 0.5 ? 0.5 : hoursLeft <= 3 ? 3 : hoursLeft <= 6 ? 6 : 24;

  // Skip if the reminder has already been sent
  if (assignment.remindersSent.includes(reminderKey)) return;

  const embed = new EmbedBuilder()
    .setTitle(`Reminder: ${assignment.name}`)
    .addFields(
      { 
        name: 'Deadline', 
        value: `<t:${Math.floor(new Date(assignment.deadline).getTime() / 1000)}:F>`, 
        inline: true 
      },
      { 
        name: 'Time Left', 
        value: `<t:${Math.floor(new Date(assignment.deadline).getTime() / 1000)}:R>` || 'N/A', 
        inline: true 
      },
      { 
        name: 'Points Worth', 
        value: String(assignment.points_possible || 'N/A'), 
        inline: true 
      },
      { 
        name: 'Submission Type', 
        value: Array.isArray(assignment.submission_types) && assignment.submission_types.length > 0 
          ? assignment.submission_types.join(', ') 
          : 'N/A', 
        inline: true 
      },
      { 
        name: 'Link', 
        value: `[View Assignment](${assignment.html_url})`, 
        inline: false 
      }
    )
    .setTimestamp()
    .setColor(reminderColor);

  try {
    // await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] }); //-------------------------------------------------------------------
    console.log(`Reminder sent: ${reminders[reminderKey]} for assignment ${assignment.name}`);
    storedData.assignments[i].remindersSent.push(reminderKey);
    await saveAssignments(storedData);
  } catch (error) {
    console.error(`Failed to send reminder for ${assignment.name}:`, error);
  }
}