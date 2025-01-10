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
  if (hoursLeft <= 0.5) return 0xff0000; // Red: < 30 minutes
  if (hoursLeft <= 3) return 0xffa500; // Orange: < 3 hours
  if (hoursLeft <= 24) return 0xffff00; // Yellow: < 1 day
  return 0x00ff00; // Green (default, won't trigger reminders)
}

// Send reminders
async function sendReminder(assignment, hoursLeft, channel, storedAssignments) {
  const reminderColor = getReminderEmbedColor(hoursLeft);
  const reminders = { 24: "1 day left", 3: "3 hours left", 0.5: "30 minutes left" };
  const reminderKey = hoursLeft <= 0.5 ? 0.5 : hoursLeft <= 3 ? 3 : 24;

  // Skip if the reminder has already been sent
  if (assignment.remindersSent.includes(reminderKey)) return;

  const embed = new EmbedBuilder()
    .setTitle(`Reminder: ${assignment.name}`)
    .setDescription(`This is a reminder for the upcoming assignment.`)
    .addFields(
      { name: 'Deadline', value: `<t:${Math.floor(new Date(assignment.deadline).getTime() / 1000)}:F>`, inline: true },
      { name: 'Time Left', value: reminders[reminderKey], inline: true },
      { name: 'Points Worth', value: String(assignment.points_possible || 'N/A'), inline: true }
    )
    .setTimestamp()
    .setColor(reminderColor);

  try {
    await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
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
  const storedData = await loadAssignments();
  const storedAssignments = storedData.assignments;

  for (const assignment of assignments) {
    const dueDate = new Date(assignment.due_at);
    if (dueDate <= date) continue;

    const isStored = storedAssignments.some((stored) => stored.id === assignment.id);
    if (isStored) continue;

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
      const sentMessage = await channel.send({ content: `${rolePing}, a new assignment has been posted!`, embeds: [embed] });
      console.log(`Notification sent for assignment: ${assignment.name}`);
      storedAssignments.push({
        id: assignment.id,
        name: assignment.name,
        deadline: assignment.due_at,
        points_possible: assignment.points_possible,
        remindersSent: [],
      });
    } catch (error) {
      console.error(`Failed to send notification for assignment: ${assignment.name}`, error);
    }
  }

  await saveAssignments({ assignments: storedAssignments });
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await ensureJsonFile();

  setInterval(() => {
    checkForNewAssignments()
      .then(() => console.log('Assignment check completed.'))
      .catch((error) => console.error('Error during assignment check:', error));

    checkForReminders()
      .then(() => console.log('Reminder check completed.'))
      .catch((error) => console.error('Error during reminder check:', error));
  }, 10 * 60 * 1000);

  await checkForNewAssignments();
  await checkForReminders();
});

client.login(DISCORD_TOKEN);
