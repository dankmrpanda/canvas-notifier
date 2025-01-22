import fs from 'fs/promises';
import { dataFilePath } from '../../config.js';
export async function loadPing() {
  try {
    let data = await fs.readFile(dataFilePath, 'utf-8');
    // Parse JSON and return the entire content
    data = JSON.parse(data.trim() || '{}'); 
    if (!Array.isArray(data.users)) {
      data.users = [];
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

// export async function 