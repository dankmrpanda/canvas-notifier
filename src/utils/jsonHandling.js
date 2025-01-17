import fs from 'fs/promises';
import { dataFilePath, dataDirectoryPath} from '../../config.js';
import { saveAssignments } from './assignments.js';

// Ensure the directory and JSON file exist
export async function ensureJsonFile() {
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