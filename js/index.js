/*
npm init -y
npm install discord.js dotenv node-fetch string-strip-html
node index.js
*/

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { stripHtml } from 'string-strip-html';

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CANVAS_TOKEN = process.env.CANVAS_TOKEN;
const COURSE_ID = process.env.COURSE_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;

const dataDirectoryPath = './courses';
const dataFilePath = path.resolve(`${dataDirectoryPath}/${COURSE_ID}.json`);

// Ensure the directory and JSON file exist
async function ensureJsonFile() {
  try {
    await fs.mkdir(dataDirectoryPath, { recursive: true });
    try {
      await fs.access(dataFilePath);
    } catch {
      const initialData = { assignments: [] };
      await saveAssignments(initialData);
      console.log(`Created file: ${dataFilePath}`);
    }
  } catch (error) {
    console.error('Error ensuring JSON file:', error);
  }
}

// Load or initialize JSON
async function loadAssignments() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(data.trim() || '{"assignments": []}');
  } catch (error) {
    console.error('Error reading assignments file:', error);
    return { assignments: [] };
  }
}

// Save assignments to JSON
async function saveAssignments(assignments) {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(assignments, null, 2));
  } catch (error) {
    console.error('Error saving assignments file:', error);
  }
}

// Fetch assignments
async function fetchAssignments() {
  const response = await fetch(`https://hlpschools.instructure.com/api/v1/courses/${COURSE_ID}/assignments?per_page=100`, {
    headers: { Authorization: `Bearer ${CANVAS_TOKEN}` },
  });
  if (!response.ok) {
    console.error('Failed to fetch assignments:', response.statusText);
    return [];
  }
  return response.json();
}

// Determine embed color for normal postings
function getNormalEmbedColor() {
  return 0x3498db; // Blue
}

// Determine reminder embed color
function getReminderEmbedColor(hoursLeft) {
  if (hoursLeft <= 1) return 0xff0000; // Red: < 1 hour
  if (hoursLeft <= 3) return 0xffa500; // Orange: < 3 hours
  if (hoursLeft <= 6) return 0xffa500; // Orange: < 6 hours
  if (hoursLeft <= 24) return 0xffff00; // Yellow: < 1 day
  return 0x00ff00; // Green (default, won't trigger reminders)
}

// Send reminders
async function sendReminder(assignment, hoursLeft, channel, storedAssignments) {
  const reminderColor = getReminderEmbedColor(hoursLeft);
  const reminders = { 24: "1 day left", 6: "6 hours left", 3: "3 hours left", 1: "30 minutes left" };
  const reminderKey = hoursLeft <= 1 ? 1 : hoursLeft <= 3 ? 3 : hoursLeft <= 6 ? 6 : 24;

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
        value: reminders[reminderKey] || 'N/A', 
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
    // Mark reminder as sent
    assignment.remindersSent.push(reminderKey);
    await saveAssignments({ assignments: storedAssignments });
  } catch (error) {
    console.error(`Failed to send reminder for ${assignment.name}:`, error);
  }
}

// Check for new assignments
async function checkForNewAssignments() {
  const assignments = await fetchAssignments();
  const channel = client.channels.cache.get(CHANNEL_ID);

  if (!channel) {
    console.error('Channel not found');
    return;
  }

  const date = new Date();

  // Load existing data
  let storedData;
  try {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    storedData = JSON.parse(fileContent.trim() || '{}');
  } catch (error) {
    console.error('Error reading assignments file:', error);
    storedData = { assignments: [] };
  }

  // Ensure the assignments array exists in the JSON data
  if (!Array.isArray(storedData.assignments)) {
    storedData.assignments = [];
  }

  const storedAssignments = storedData.assignments;

  for (const assignment of assignments) {
    const dueDate = new Date(assignment.due_at);
    if (dueDate <= date) continue; // Skip past-due assignments

    const isStored = storedAssignments.some((stored) => stored.id === assignment.id);
    if (isStored) continue; // Skip already stored assignments

    // Prepare the embed for the new assignment
    const embed = new EmbedBuilder()
      .setTitle(assignment.name)
      .setDescription(stripHtml(assignment.description || '').result.trim() || 'No description available.')
      .addFields(
        { name: 'Deadline', value: `<t:${Math.floor(dueDate.getTime() / 1000)}:F>`, inline: true },
        { name: 'Points Worth', value: String(assignment.points_possible || 'N/A'), inline: true },
        { name: 'Submission Type', value: assignment.submission_types.join(', ') || 'N/A', inline: true },
        { name: 'Link', value: `[View Assignment](${assignment.html_url})`, inline: false }
      )
      .setTimestamp()
      .setColor(getNormalEmbedColor());

    const rolePing = `<@&${ROLE_ID}>`;

    try {
      // Send the assignment notification to the channel
      // const sentMessage = await channel.send({ content: `${rolePing}, a new assignment has been posted!`, embeds: [embed] });
      console.log(`Notification sent for assignment: ${assignment.name}`);

      // Append the new assignment to the stored assignments
      storedAssignments.push({
        id: assignment.id,
        name: assignment.name,
        deadline: assignment.due_at,
        points_possible: assignment.points_possible,
        link: assignment.html_url,
        submission_type: assignment.submission_types,
        remindersSent: [],
      });
    } catch (error) {
      console.error(`Failed to send notification for assignment: ${assignment.name}`, error);
    }
  }

  // Save the updated JSON data without overwriting the entire file
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(storedData, null, 2));
    console.log('Updated assignments saved successfully.');
  } catch (error) {
    console.error('Error saving assignments file:', error);
  }
}

// Check for reminders
async function checkForReminders() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const date = new Date();
  const storedData = await loadAssignments();
  const storedAssignments = storedData.assignments;

  for (const assignment of storedAssignments) {
    const dueDate = new Date(assignment.deadline);
    const hoursLeft = (dueDate - date) / (1000 * 60 * 60);

    if (hoursLeft <= 24 && hoursLeft > 0) {
      await sendReminder(assignment, hoursLeft, channel, storedAssignments);
    }
  }
}

async function remindercheck() {
  while (true) {
    try {
      await checkForReminders();
      // console.log('Reminder check completed.');
    } catch (error) {
      console.error('Error during reminder check:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await ensureJsonFile();

  // Run both checks immediately
  try {
    await checkForNewAssignments();
    console.log('Initial assignment check completed.');
    await checkForReminders();
    console.log('Initial reminder check completed.');
  } catch (error) {
    console.error('Error during initial checks:', error);
  }

  // Variable to track the last check time for assignments
  let lastAssignmentCheckTime = Date.now();

  // Schedule checks to run every 10 minutes
  setInterval(async () => {
    const currentTime = Date.now();
    const timeSinceLastCheck = (currentTime - lastAssignmentCheckTime) / 1000; // Time in seconds

    try {
      console.log(`Time since last assignment check: ${timeSinceLastCheck.toFixed(2)} seconds`);
      await checkForNewAssignments();
      console.log('Assignment check completed.');
      lastAssignmentCheckTime = currentTime; // Update the last check time
    } catch (error) {
      console.error('Error during assignment check:', error);
    }
  }, 10 * 60 * 1000); // Every 5 seconds (update the interval as needed)

  remindercheck().catch(err =>
    console.error('Uncaught error in reminder check loop:', err)
  );
});

async function loadReminders() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(data.trim() || '[]').reminder; // Parse JSON or default to an empty array
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return an empty array
      return [];
    } else {
      console.error('Error reading reminders file:', error);
      return [];
    }
  }
}
// Function to save reminders to JSON
async function saveReminders(reminders) {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(reminders, null, 2));
  } catch (error) {
    console.error('Error saving reminders file:', error);
  }
}


client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'ping') {
    const toggle = interaction.options.get('toggle').value;
    try {
      // Read the existing JSON file
      let data;
      try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        data = JSON.parse(fileContent.trim() || '{}');
      } catch {
        data = {}; // Initialize an empty object if file doesn't exist
      }

      // Ensure the 'user' array exists
      if (!Array.isArray(data.user)) {
        data.user = [];
      }

      // Check the toggle value
      if (toggle) {
        // Add user to the list if not already present
        if (!data.user.includes(interaction.user.id)) {
          data.user.push(interaction.user.id);
          await interaction.reply({ content: 'Pings enabled for you!', flags: 64 }); // 64 is for ephemeral messages
        } else {
          await interaction.reply({ content: 'Pings are already enabled for you!', flags: 64 });
        }
      } else {
        // Remove user from the list if present
        if (data.user.includes(interaction.user.id)) {
          data.user = data.user.filter((id) => id !== interaction.user.id);
          await interaction.reply({ content: 'Pings disabled for you!', flags: 64 });
        } else {
          await interaction.reply({ content: 'Pings are already disabled for you!', flags: 64 });
        }
      }

      // Write the updated JSON back to the file
      await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving assignments file:', error);
      await interaction.reply({ content: 'An error occurred while updating your preferences.', flags: 64 });
    }
  }

  if (interaction.commandName === 'add-reminder') {
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

    // Save the reminder to a file or database (example uses JSON file)
    const reminder = {
      title,
      description,
      date: reminderDateTime.toISOString(),
      userId: interaction.user.id,
    };
    try {
      let data;
      try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        data = JSON.parse(fileContent.trim() || '{}');
      } catch {
        data = {}; // Initialize an empty object if file doesn't exist
      }

      // Ensure the 'user' array exists
      if (!Array.isArray(data.reminder)) {
        data.reminder = [];
      }

        data.reminder.push(reminder);
      await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));

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

  if (interaction.isAutocomplete() && interaction.commandName === 'delete-reminder') {
    console.log("Processing autocomplete...");
    try {
      const reminders = await loadReminders();
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
      console.log(choices);
      // Respond with up to 25 choices (Discord's limit)
      await interaction.respond(choices.slice(0, 25));
    } catch (error) {
      console.error('Error handling autocomplete:', error);
      await interaction.respond([]); // Send an empty response if an error occurs
    }
  }
  
  // Handle delete-reminder command
  if (interaction.isChatInputCommand() && interaction.commandName === 'delete-reminder') {
    try {
      let data;

      // Load the existing JSON file
      try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        data = JSON.parse(fileContent.trim() || '{}');
      } catch {
        data = {}; // Initialize an empty object if the file doesn't exist
      }

      // Ensure the `reminder` field exists and is an array
      if (!Array.isArray(data.reminder)) {
        data.reminder = [];
      }

      // Get the reminder index from the interaction
      const reminderIndex = interaction.options.getString('reminder');

      // Validate input: ensure it's an index from autocomplete
      if (!reminderIndex || isNaN(reminderIndex) || parseInt(reminderIndex, 10) < 0 || parseInt(reminderIndex, 10) >= data.reminder.length) {
        return await interaction.reply({
          content: 'Invalid input. Please select a valid reminder from the autocomplete options.',
          flags: 64 // Ephemeral message to notify the user without cluttering the channel
        });
      }

      // Remove the selected reminder
      const index = parseInt(reminderIndex, 10);
      const reminderToDelete = data.reminder[index];
      data.reminder.splice(index, 1); // Remove the reminder by index

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

});

client.login(DISCORD_TOKEN);