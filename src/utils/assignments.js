import fs from 'fs/promises';
import { dataFilePath, CANVAS_TOKEN, CHANNEL_ID, COURSE_ID} from '../../config.js';
import { EmbedBuilder } from 'discord.js';
import { stripHtml } from 'string-strip-html';


// Load or initialize JSON
export async function loadAssignments() {
  try {
    let data = await fs.readFile(dataFilePath, 'utf-8');
    // Parse JSON and return the entire content
    data = JSON.parse(data.trim() || '{}'); 
    if (!Array.isArray(data.assignments)) {
      data.assignments = [];
    }
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return an empty JSON object
      return {};
    } else {
      console.error('Error reading json file:', error);
      throw error; // Re-throw the error to be handled upstream
    }
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

// Check for new assignments and update JSON file
export async function checkForNewAssignments(client) {
  const assignments = await fetchAssignments();
  const channel = client.channels.cache.get(CHANNEL_ID);

  if (!channel) {
    console.error('Channel not found');
    return;
  }

  const date = new Date();

  // Load existing data
  let storedData = await loadAssignments();
  const storedAssignments = storedData.assignments;
  for (const assignment of assignments) {
    const dueDate = new Date(assignment.due_at);
    if (dueDate <= date) continue; // Skip past-due assignments

    const storedAssignmentIndex = storedAssignments.findIndex((stored) => stored.id === assignment.id);

    if (storedAssignmentIndex >= 0) {
      // Assignment exists in JSON, check for updates
      const storedAssignment = storedAssignments[storedAssignmentIndex];
      let updated = false;

      // Check for changes in the assignment details
      if (new Date(storedAssignment.deadline).getTime() !== dueDate.getTime()) {
        storedAssignment.deadline = assignment.due_at;
        updated = true;
      }
      // if (storedAssignment.points_possible !== assignment.points_possible) {
      //   storedAssignment.points_possible = assignment.points_possible;
      //   updated = true;
      // }
      // if (storedAssignment.name !== assignment.name) {
      //   storedAssignment.name = assignment.name;
      //   updated = true;
      // }
      // if (storedAssignment.link !== assignment.html_url) {
      //   storedAssignment.link = assignment.html_url;
      //   updated = true;
      // }
      // if (JSON.stringify(storedAssignment.submission_type) !== JSON.stringify(assignment.submission_types)) {
      //   storedAssignment.submission_type = assignment.submission_types;
      //   updated = true;
      // }

      if (updated) {
        console.log(`Updated assignment: ${assignment.name}`);
        // Notify about the update (optional)
        storedAssignments[storedAssignmentIndex] = {
          id: assignment.id,
          name: assignment.name,
          deadline: assignment.due_at,
          points_possible: assignment.points_possible,
          link: assignment.html_url,
          submission_type: assignment.submission_types,
          remindersSent: [],
        };
        const updateEmbed = new EmbedBuilder()
          .setTitle(`Updated Assignment: ${assignment.name}`)
          .setDescription(`<t:${Math.floor(new Date(storedAssignment.deadline).getTime() / 1000)}:F> ==> <t:${Math.floor(dueDate.getTime() / 1000)}:F>`)
          .addFields(
            { name: 'New Deadline', value: `<t:${Math.floor(dueDate.getTime() / 1000)}:F>`, inline: true },
            { name: 'Link', value: `[View Assignment](${assignment.html_url})`, inline: false }
          )
          .setColor(0xFFA500); // Orange for updates

        try {
          await channel.send({ content: `The assignment "${assignment.name}" has been updated!`, embeds: [updateEmbed] });
        } catch (error) {
          console.error(`Failed to send update notification for assignment: ${assignment.name}`, error);
        }
      }
    } else {
      // New assignment: Add it to the stored assignments
      console.log(`Adding new assignment: ${assignment.name}`);
      storedAssignments.push({
        id: assignment.id,
        name: assignment.name,
        deadline: assignment.due_at,
        points_possible: assignment.points_possible,
        link: assignment.html_url,
        submission_type: assignment.submission_types,
        remindersSent: [],
      });

      // Notify about the new assignment
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
        .setColor(0x3498DB); // Blue for new assignments

      try {
        await channel.send({ content: `A new assignment has been posted!`, embeds: [embed] });
      } catch (error) {
        console.error(`Failed to send notification for assignment: ${assignment.name}`, error);
      }
    }
  }

  // Save the updated JSON data
  saveAssignments(storedData)
}
