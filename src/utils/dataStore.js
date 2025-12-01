/**
 * Unified Data Store
 * Handles all JSON file operations for assignments, reminders, and user preferences
 * Supports multiple courses with separate data files and dynamic configuration
 */
import fs from 'fs/promises';
import { DATA_DIR, CONFIG_FILE, getDataFilePath, COURSES, setCourses } from '../../config.js';

// Default data structure
const DEFAULT_DATA = {
    assignments: [],
    reminders: [],
    users: []
};

// =============================================================================
// CONFIGURATION PERSISTENCE
// =============================================================================

/**
 * Save course configurations to disk
 * Used to persist auto-discovered courses
 * @param {Array} courseConfigs - Array of course configurations
 */
export async function saveCourseConfigs(courseConfigs) {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(courseConfigs, null, 2));
        console.log(`Saved ${courseConfigs.length} course configurations`);
    } catch (error) {
        console.error('Error saving course configs:', error);
        throw error;
    }
}

/**
 * Load course configurations from disk
 * @returns {Promise<Array|null>} Course configurations or null if not found
 */
export async function loadCourseConfigs() {
    try {
        const content = await fs.readFile(CONFIG_FILE, 'utf-8');
        const configs = JSON.parse(content);
        
        if (Array.isArray(configs)) {
            console.log(`Loaded ${configs.length} course configurations from disk`);
            return configs;
        }
        
        return null;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist yet
        }
        console.error('Error loading course configs:', error);
        return null;
    }
}

/**
 * Initialize courses from saved config or return empty
 * Updates the global COURSES array
 * @returns {Promise<Array>} Course configurations
 */
export async function initializeCourseConfigs() {
    const savedConfigs = await loadCourseConfigs();
    
    if (savedConfigs && savedConfigs.length > 0) {
        setCourses(savedConfigs);
        return savedConfigs;
    }
    
    return COURSES;
}

// =============================================================================
// MULTI-COURSE DATA OPERATIONS
// =============================================================================

/**
 * Ensure the data directory exists and all course files are initialized
 */
export async function ensureDataFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        for (const course of COURSES) {
            const filePath = getDataFilePath(course.courseId);
            
            try {
                await fs.access(filePath);
                // Validate existing file structure
                const data = await loadCourseData(course.courseId);
                let needsSave = false;
                
                if (!Array.isArray(data.assignments)) {
                    data.assignments = [];
                    needsSave = true;
                }
                if (!Array.isArray(data.reminders)) {
                    data.reminders = [];
                    needsSave = true;
                }
                if (!Array.isArray(data.users)) {
                    data.users = [];
                    needsSave = true;
                }
                
                if (needsSave) {
                    await saveCourseData(course.courseId, data);
                }
            } catch {
                await saveCourseData(course.courseId, { ...DEFAULT_DATA });
                console.log(`Created data file for course ${course.courseId}`);
            }
        }
    } catch (error) {
        console.error('Error ensuring data files:', error);
        throw error;
    }
}

/**
 * Load data for a specific course
 * @param {string} courseId - The course ID
 * @returns {Promise<Object>} The data object
 */
export async function loadCourseData(courseId) {
    const filePath = getDataFilePath(courseId);
    
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content.trim() || '{}');
        
        return {
            assignments: Array.isArray(data.assignments) ? data.assignments : [],
            reminders: Array.isArray(data.reminders) ? data.reminders : [],
            users: Array.isArray(data.users) ? data.users : []
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { ...DEFAULT_DATA };
        }
        console.error(`Error reading data file for course ${courseId}:`, error);
        throw error;
    }
}

/**
 * Save data for a specific course
 * @param {string} courseId - The course ID
 * @param {Object} data - The data to save
 */
export async function saveCourseData(courseId, data) {
    const filePath = getDataFilePath(courseId);
    
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving data file for course ${courseId}:`, error);
        throw error;
    }
}

// =============================================================================
// LEGACY SINGLE-COURSE OPERATIONS (for backward compatibility)
// =============================================================================

const getDefaultCourseId = () => COURSES[0]?.courseId;

export async function ensureDataFile() {
    return ensureDataFiles();
}

export async function loadData() {
    const courseId = getDefaultCourseId();
    if (!courseId) {
        return { ...DEFAULT_DATA };
    }
    return loadCourseData(courseId);
}

export async function saveData(data) {
    const courseId = getDefaultCourseId();
    if (!courseId) {
        throw new Error('No course configured');
    }
    return saveCourseData(courseId, data);
}

// =============================================================================
// ASSIGNMENT OPERATIONS (Course-specific)
// =============================================================================

export async function getCourseAssignments(courseId) {
    const data = await loadCourseData(courseId);
    return data.assignments;
}

export async function saveCourseAssignments(courseId, assignments) {
    const data = await loadCourseData(courseId);
    data.assignments = assignments;
    await saveCourseData(courseId, data);
}

// Legacy operations
export async function getAssignments() {
    const data = await loadData();
    return data.assignments;
}

export async function saveAssignments(assignments) {
    const data = await loadData();
    data.assignments = assignments;
    await saveData(data);
}

export async function addAssignment(assignment) {
    const data = await loadData();
    data.assignments.push(assignment);
    await saveData(data);
}

export async function updateAssignment(id, updates) {
    const data = await loadData();
    const index = data.assignments.findIndex(a => a.id === id);
    if (index !== -1) {
        data.assignments[index] = { ...data.assignments[index], ...updates };
        await saveData(data);
        return true;
    }
    return false;
}

export async function removeAssignment(id) {
    const data = await loadData();
    data.assignments = data.assignments.filter(a => a.id !== id);
    await saveData(data);
}

// =============================================================================
// REMINDER OPERATIONS (Global - stored in first course file)
// =============================================================================

export async function getReminders() {
    const data = await loadData();
    return data.reminders;
}

export async function saveReminders(reminders) {
    const data = await loadData();
    data.reminders = reminders;
    await saveData(data);
}

export async function addReminder(reminder) {
    const data = await loadData();
    data.reminders.push(reminder);
    await saveData(data);
}

export async function removeReminder(index) {
    const data = await loadData();
    if (index >= 0 && index < data.reminders.length) {
        const removed = data.reminders.splice(index, 1)[0];
        await saveData(data);
        return removed;
    }
    return null;
}

export async function updateReminderSent(index, reminderKey) {
    const data = await loadData();
    if (index >= 0 && index < data.reminders.length) {
        if (!Array.isArray(data.reminders[index].remindersSent)) {
            data.reminders[index].remindersSent = [];
        }
        data.reminders[index].remindersSent.push(reminderKey);
        await saveData(data);
    }
}

// =============================================================================
// USER PREFERENCE OPERATIONS (Global)
// =============================================================================

export async function getUsers() {
    const data = await loadData();
    return data.users;
}

export async function addUser(userId) {
    const data = await loadData();
    if (!data.users.includes(userId)) {
        data.users.push(userId);
        await saveData(data);
        return true;
    }
    return false;
}

export async function removeUser(userId) {
    const data = await loadData();
    const index = data.users.indexOf(userId);
    if (index !== -1) {
        data.users.splice(index, 1);
        await saveData(data);
        return true;
    }
    return false;
}

export async function hasUser(userId) {
    const data = await loadData();
    return data.users.includes(userId);
}
