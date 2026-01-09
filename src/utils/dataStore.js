/**
 * Unified Data Store
 * Handles all JSON file operations for assignments, reminders, and user preferences
 * Supports multiple courses with separate data files and dynamic configuration
 */
import fs from 'fs/promises';
import { DATA_DIR, CONFIG_FILE, getDataFilePath, COURSES, setCourses } from '../../config.js';
import log from './logger.js';

// Default data structure for course-specific data
const DEFAULT_DATA = {
    assignments: [],
    reminders: [],
    users: [],
    roleEmbedMessageId: null  // Track the role selection embed message ID
};

// Simple in-memory lock to prevent concurrent writes to the same file
const fileLocks = new Map();

/**
 * Acquire a lock for a file path
 * @param {string} filePath - Path to lock
 * @returns {Promise<void>}
 */
async function acquireLock(filePath) {
    while (fileLocks.get(filePath)) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    fileLocks.set(filePath, true);
}

/**
 * Release a lock for a file path
 * @param {string} filePath - Path to unlock
 */
function releaseLock(filePath) {
    fileLocks.delete(filePath);
}

// =============================================================================
// CONFIGURATION PERSISTENCE
// =============================================================================

/**
 * Save course configurations to disk
 * Used to persist auto-discovered courses
 * @param {Array} courseConfigs - Array of course configurations
 */
export async function saveCourseConfigs(courseConfigs) {
    await acquireLock(CONFIG_FILE);
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(courseConfigs, null, 2));
        log.info(`Saved ${courseConfigs.length} course configurations`);
    } catch (error) {
        log.error('Error saving course configs:', error);
        throw error;
    } finally {
        releaseLock(CONFIG_FILE);
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
            log.info(`Loaded ${configs.length} course configurations from disk`);
            return configs;
        }

        return null;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist yet
        }
        log.error('Error loading course configs:', error);
        return null;
    }
}

/**
 * Update roles channel ID for all courses in a category
 * @param {string} categoryId - The category ID
 * @param {string} rolesChannelId - The roles channel ID
 */
export async function updateRolesChannelForCategory(categoryId, rolesChannelId) {
    const configs = await loadCourseConfigs();
    if (!configs) return;

    let updated = false;
    for (const config of configs) {
        if (config.categoryId === categoryId && config.rolesChannelId !== rolesChannelId) {
            config.rolesChannelId = rolesChannelId;
            updated = true;
        }
    }

    if (updated) {
        setCourses(configs);
        await saveCourseConfigs(configs);
        log.debug(`Updated rolesChannelId for category ${categoryId}`);
    }
}

/**
 * Get the roles channel ID for a category from saved configs
 * @param {string} categoryId - The category ID
 * @returns {Promise<string|null>} The roles channel ID or null
 */
export async function getRolesChannelForCategory(categoryId) {
    const configs = await loadCourseConfigs();
    if (!configs) return null;

    // Find any course in this category that has a roles channel ID
    const courseWithRolesChannel = configs.find(
        c => c.categoryId === categoryId && c.rolesChannelId
    );

    return courseWithRolesChannel?.rolesChannelId || null;
}

/**
 * Update the role embed message ID for a course
 * @param {string} courseId - The course ID
 * @param {string} messageId - The message ID of the role embed
 */
export async function updateRoleEmbedMessageId(courseId, messageId) {
    const data = await loadCourseData(courseId);
    data.roleEmbedMessageId = messageId;
    await saveCourseData(courseId, data);
    log.debug(`Updated roleEmbedMessageId for course ${courseId}`);
}

/**
 * Get the role embed message ID for a course
 * @param {string} courseId - The course ID
 * @returns {Promise<string|null>} The message ID or null
 */
export async function getRoleEmbedMessageId(courseId) {
    const data = await loadCourseData(courseId);
    return data.roleEmbedMessageId || null;
}

/**
 * Delete a course data file
 * @param {string} courseId - The course ID
 * @returns {Promise<boolean>} True if deleted, false if didn't exist
 */
export async function deleteCourseDataFile(courseId) {
    const filePath = getDataFilePath(courseId);

    try {
        await fs.unlink(filePath);
        log.info(`Deleted data file for course ${courseId}`);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false; // File didn't exist
        }
        log.error(`Error deleting data file for course ${courseId}`, error);
        return false;
    }
}

/**
 * Remove a course from the saved configuration
 * @param {string} courseId - The course ID to remove
 * @returns {Promise<boolean>} True if removed
 */
export async function removeCourseFromConfig(courseId) {
    const configs = await loadCourseConfigs();
    if (!configs) return false;

    const initialLength = configs.length;
    const filtered = configs.filter(c => c.courseId !== courseId);

    if (filtered.length < initialLength) {
        setCourses(filtered);
        await saveCourseConfigs(filtered);
        log.info(`Removed course ${courseId} from configuration`);
        return true;
    }

    return false;
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
                log.info(`Created data file for course ${course.courseId}`);
            }
        }
    } catch (error) {
        log.error('Error ensuring data files:', error);
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
            users: Array.isArray(data.users) ? data.users : [],
            roleEmbedMessageId: data.roleEmbedMessageId || null
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { ...DEFAULT_DATA };
        }
        log.error(`Error reading data file for course ${courseId}`, error);
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

    await acquireLock(filePath);
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        log.error(`Error saving data file for course ${courseId}`, error);
        throw error;
    } finally {
        releaseLock(filePath);
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
