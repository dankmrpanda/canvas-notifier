/**
 * Canvas Notifier Bot Configuration
 * Central configuration file for all bot settings
 * Supports automatic course discovery from Canvas
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// REQUIRED ENVIRONMENT VARIABLES
// =============================================================================

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const CANVAS_TOKEN = process.env.CANVAS_TOKEN;
export const GUILD_ID = process.env.GUILD_ID; // Required for auto-setup

// =============================================================================
// CANVAS API CONFIGURATION
// =============================================================================

export const CANVAS_CONFIG = {
    baseUrl: process.env.CANVAS_BASE_URL || 'https://canvas.cmu.edu',
    assignmentsPerPage: 100
};

// =============================================================================
// AUTO-DISCOVERY MODE
// =============================================================================

/**
 * When AUTO_DISCOVER is true, the bot will:
 * 1. Fetch all courses from Canvas automatically
 * 2. Create roles based on Section.name (numbers before first dash)
 * 3. Create categories based on Term.name
 * 4. Create channels with the same name as roles
 * 5. Only create channels for courses with assignments
 */
export const AUTO_DISCOVER = process.env.AUTO_DISCOVER !== 'false'; // Default true

// =============================================================================
// MULTI-COURSE CONFIGURATION (Manual mode fallback)
// =============================================================================

/**
 * Parse course configurations from environment variables
 * Used when AUTO_DISCOVER is false
 * 
 * Format 1 (Single course - legacy):
 *   COURSE_ID=12345
 *   CHANNEL_ID=111111
 *   ROLE_ID=222222
 * 
 * Format 2 (Multiple courses):
 *   COURSES=12345:111111:222222,67890:333333:444444
 *   Format: courseId:channelId:roleId,courseId:channelId:roleId,...
 * 
 * @returns {Array<{courseId: string, channelId: string, roleId: string}>}
 */
function parseCourseConfigs() {
    const courses = [];
    
    // Check for multi-course format first
    if (process.env.COURSES) {
        const courseEntries = process.env.COURSES.split(',').map(s => s.trim()).filter(Boolean);
        
        for (const entry of courseEntries) {
            const parts = entry.split(':').map(s => s.trim());
            
            if (parts.length >= 2) {
                courses.push({
                    courseId: parts[0],
                    channelId: parts[1],
                    roleId: parts[2] || null  // Role is optional
                });
            }
        }
    }
    
    // Fall back to single course format (legacy support)
    if (courses.length === 0 && process.env.COURSE_ID && process.env.CHANNEL_ID) {
        courses.push({
            courseId: process.env.COURSE_ID,
            channelId: process.env.CHANNEL_ID,
            roleId: process.env.ROLE_ID || null
        });
    }
    
    return courses;
}

/**
 * Array of course configurations
 * This will be populated dynamically in auto-discover mode
 * or from environment variables in manual mode
 */
export let COURSES = parseCourseConfigs();

/**
 * Update the courses configuration dynamically
 * Used by auto-discovery to set courses at runtime
 * @param {Array} newCourses - New course configurations
 */
export function setCourses(newCourses) {
    COURSES = newCourses;
}

/**
 * Add a course to the configuration
 * @param {Object} course - Course configuration
 */
export function addCourse(course) {
    // Check if course already exists
    const existing = COURSES.findIndex(c => c.courseId === course.courseId);
    if (existing >= 0) {
        COURSES[existing] = course;
    } else {
        COURSES.push(course);
    }
}

// Legacy single-course exports (for backward compatibility)
export const COURSE_ID = COURSES[0]?.courseId;
export const CHANNEL_ID = COURSES[0]?.channelId;
export const ROLE_ID = COURSES[0]?.roleId;

// =============================================================================
// BOT TIMING CONFIGURATION (in milliseconds)
// =============================================================================

export const TIMING = {
    assignmentCheckInterval: 10 * 60 * 1000,  // 10 minutes
    reminderCheckInterval: 60 * 1000,          // 1 minute
    customReminderCheckInterval: 60 * 1000,    // 1 minute
    courseRefreshInterval: 60 * 60 * 1000      // 1 hour - refresh course list
};

// =============================================================================
// REMINDER THRESHOLDS (in hours)
// =============================================================================

export const REMINDER_THRESHOLDS = {
    assignment: [24, 6, 3, 0.5],  // 1 day, 6 hours, 3 hours, 30 minutes
    custom: [168, 72, 24, 0]      // 1 week, 3 days, 1 day, now
};

export const REMINDER_LABELS = {
    assignment: {
        24: '1 day left',
        6: '6 hours left',
        3: '3 hours left',
        0.5: '30 minutes left'
    },
    custom: {
        168: '1 week left',
        72: '3 days left',
        24: '1 day left',
        0: 'Now'
    }
};

// =============================================================================
// EMBED COLORS
// =============================================================================

export const COLORS = {
    newAssignment: 0x3498db,    // Blue
    updatedAssignment: 0xffa500, // Orange
    reminder: {
        urgent: 0xff0000,        // Red: < 1 hour
        warning: 0xffa500,       // Orange: < 6 hours
        caution: 0xffff00,       // Yellow: < 24 hours
        normal: 0x00ff00         // Green: > 24 hours
    },
    success: 0x00ff00,           // Green
    error: 0xff0000              // Red
};

// =============================================================================
// FILE PATHS
// =============================================================================

export const DATA_DIR = path.resolve(__dirname, 'courses');
export const CONFIG_FILE = path.resolve(DATA_DIR, '_config.json');

/**
 * Get the data file path for a specific course
 * @param {string} courseId - The course ID
 * @returns {string} Full path to the course data file
 */
export function getDataFilePath(courseId) {
    return path.resolve(DATA_DIR, `${courseId}.json`);
}

// Legacy export for backward compatibility
export const DATA_FILE = getDataFilePath(COURSE_ID);
export const dataDirectoryPath = DATA_DIR;
export const dataFilePath = DATA_FILE;

// =============================================================================
// VALIDATION
// =============================================================================

const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'CANVAS_TOKEN'
];

export function validateConfig() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        return false;
    }
    
    // In auto-discover mode, we need GUILD_ID
    if (AUTO_DISCOVER && !GUILD_ID) {
        console.error('AUTO_DISCOVER mode requires GUILD_ID in .env');
        console.error('Set GUILD_ID to your Discord server ID, or set AUTO_DISCOVER=false');
        return false;
    }
    
    // In manual mode, check for course configuration
    if (!AUTO_DISCOVER && COURSES.length === 0) {
        console.error('No courses configured. Set COURSES or COURSE_ID/CHANNEL_ID in .env');
        console.error('Or enable AUTO_DISCOVER mode with GUILD_ID');
        return false;
    }
    
    if (AUTO_DISCOVER) {
        console.log('✅ Auto-discovery mode enabled');
        console.log(`   Guild ID: ${GUILD_ID}`);
        console.log('   Courses will be discovered from Canvas automatically');
    } else {
        console.log(`✅ Manual mode - Configured ${COURSES.length} course(s):`);
        COURSES.forEach((c, i) => {
            console.log(`   ${i + 1}. Course ${c.courseId} → Channel ${c.channelId}${c.roleId ? ` (Role: ${c.roleId})` : ''}`);
        });
    }
    
    return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get embed color based on hours remaining
 * @param {number} hoursLeft - Hours until deadline
 * @returns {number} Hex color code
 */
export function getEmbedColor(hoursLeft) {
    if (hoursLeft <= 1) return COLORS.reminder.urgent;
    if (hoursLeft <= 6) return COLORS.reminder.warning;
    if (hoursLeft <= 24) return COLORS.reminder.caution;
    return COLORS.reminder.normal;
}

/**
 * Get the appropriate reminder key based on hours left
 * @param {number} hoursLeft - Hours until deadline
 * @param {string} type - 'assignment' or 'custom'
 * @returns {number|null} Reminder threshold key, or null if no reminder should be sent
 */
export function getReminderKey(hoursLeft, type = 'assignment') {
    const thresholds = REMINDER_THRESHOLDS[type];
    const sortedThresholds = [...thresholds].sort((a, b) => a - b);
    
    for (const threshold of sortedThresholds) {
        if (hoursLeft <= threshold) {
            return threshold;
        }
    }
    
    return null;
}
