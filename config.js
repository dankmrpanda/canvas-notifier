import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: './.env' });

// Access the variables from process.env
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CANVAS_TOKEN = process.env.CANVAS_TOKEN;
export const COURSE_ID = process.env.COURSE_ID;
export const CHANNEL_ID = process.env.CHANNEL_ID;
export const ROLE_ID = process.env.ROLE_ID;

export const dataDirectoryPath = './courses';
export const dataFilePath = path.resolve(`${dataDirectoryPath}/${COURSE_ID}.json`);