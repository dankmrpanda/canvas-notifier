import fs from 'fs/promises';
import { dataFilePath, CANVAS_TOKEN, CHANNEL_ID, ROLE_ID, COURSE_ID} from '../../config.js';
import { EmbedBuilder } from 'discord.js';
import { stripHtml } from 'string-strip-html';
import { getNormalEmbedColor } from './reminders.js';


// Load or initialize JSON
export async function loadAssignments() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(data.trim() || '{"assignments": []}');
  } catch (error) {
    console.error('Error reading assignments file:', error);
    return { assignments: [] };
  }
}

// Save assignments to JSON
export async function saveAssignments(assignments) {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(assignments, null, 2));
  } catch (error) {
    console.error('Error saving assignments file:', error);
  }
}

// Fetch assignments
export async function fetchAssignments() {
  const response = await fetch(`https://hlpschools.instructure.com/api/v1/courses/${COURSE_ID}/assignments?per_page=100`, {
    headers: { Authorization: `Bearer ${CANVAS_TOKEN}` },
  });
  if (!response.ok) {
    console.error('Failed to fetch assignments:', response.statusText);
    return [];
  }
  return response.json();
}

// Check for new assignments
export async function checkForNewAssignments(client) {
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