import fs from 'fs/promises';
import { dataFilePath } from '../../config.js';
import { checkForReminders } from './assignmentReminders.js';
import { checkForCustomReminders } from './customReminders.js';

export async function loadReminders() {
  try {
    let data = await fs.readFile(dataFilePath, 'utf-8');
    // Parse JSON and return the entire content
    data = JSON.parse(data.trim() || '{}'); 
    if (!Array.isArray(data.reminders)) {
      data.reminders = [];
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

// Function to save reminders to JSON
export async function saveReminders(data) {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving json file:', error);
  }
}

export function getNormalEmbedColor() {
  return 0x3498db; // Blue
}

// Determine reminder embed color
export function getReminderEmbedColor(hoursLeft) {
  if (hoursLeft <= 1) return 0xff0000; // Red: < 1 hour
  if (hoursLeft <= 3) return 0xffa500; // Orange: < 3 hours
  if (hoursLeft <= 6) return 0xffa500; // Orange: < 6 hours
  if (hoursLeft <= 24) return 0xffff00; // Yellow: < 1 day
  return 0x00ff00; // Green (default, won't trigger reminders)
}

export async function remindercheck(client) {
  while (true) {
    try {
      await checkForReminders(client);
      await checkForCustomReminders(client);
      // console.log('Reminder check completed.');
    } catch (error) {
      console.error('Error during reminder check:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}