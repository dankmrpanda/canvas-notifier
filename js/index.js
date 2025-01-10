/*
npm init -y
npm install discord.js
npm install dotenv
npm install node-fetch
npm install string-strip-html
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

const dataFilePath = path.resolve('./assignments.json');

// Load or initialize JSON
async function loadAssignments() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf-8');
    if (data.trim() === '') {
      await saveAssignments({ assignments: [] });
      return { assignments: [] };
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const emptyData = { assignments: [] };
      await saveAssignments(emptyData);
      return emptyData;
    } else {
      console.error('Error reading assignments file:', error);
      return { assignments: [] };
    }
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
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
    },
  });
  if (!response.ok) {
    console.error('Failed to fetch assignments:', response.statusText);
    return [];
  }
  return response.json();
}

// Determine color based on days left
function determineColor(daysLeft) {
  if (daysLeft <= 2) return 0xff0000; // Red
  if (daysLeft <= 5) return 0xffff00; // Yellow
  return 0x00ff00; // Green
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

    const daysLeft = Math.ceil((dueDate - date) / (1000 * 60 * 60 * 24));
    const embedColor = determineColor(daysLeft);

    let description = stripHtml(assignment.description || '').result.trim();
    if (description.length > 4096) {
      description = `${description.slice(0, 4093)}...`;
    }

    const embed = new EmbedBuilder()
      .setTitle(assignment.name)
      .setDescription(description || 'No description available.')
      .addFields(
        { name: 'Deadline', value: dueDate.toLocaleString(), inline: true },
        { name: 'Points Worth', value: String(assignment.points_possible || 'N/A'), inline: true },
        { name: 'Submission Type', value: assignment.submission_types.join(', ') || 'N/A', inline: true },
        { name: 'Link', value: `[View Assignment](${assignment.html_url})`, inline: false }
      )
      .setTimestamp()
      .setColor(embedColor);

    const rolePing = `<@&${ROLE_ID}>`;

    try {
      const sentMessage = await channel.send({
        content: `${rolePing}, a new assignment has been posted!`,
        embeds: [embed],
      });
      console.log(`Notification sent for assignment: ${assignment.name}`);

      storedAssignments.push({
        id: assignment.id,
        name: assignment.name,
        messageId: sentMessage.id,
        deadline: assignment.due_at,
      });
    } catch (error) {
      console.error(`Failed to send notification for assignment: ${assignment.name}`, error);
    }
  }

  await saveAssignments({ assignments: storedAssignments });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setInterval(() => {
    checkForNewAssignments()
      .then(() => console.log('Assignment check completed.'))
      .catch((error) => console.error('Error during assignment check:', error));
  }, 10 * 60 * 1000);

  checkForNewAssignments()
    .then(() => console.log('Initial assignment check completed.'))
    .catch((error) => console.error('Error during initial assignment check:', error));
});

client.login(DISCORD_TOKEN);