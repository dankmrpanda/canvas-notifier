/**
 * Logger Utility
 * Handles logging to both console and session-based log files
 * Each bot startup creates a new session log file
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

// Generate unique session ID based on timestamp
const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
const LOG_FILE = path.join(LOG_DIR, `session_${SESSION_ID}.log`);

// Log levels
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Current log level (can be set via environment variable)
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// Track if logging to file is enabled
let fileLoggingEnabled = true;

// Ensure log directory exists
try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
} catch (err) {
    console.error('Failed to create log directory:', err.message);
    fileLoggingEnabled = false;
}

// Initialize log file with session header
const sessionStart = new Date().toISOString();
const sessionHeader = `
================================================================================
                         CANVAS NOTIFIER BOT - SESSION LOG
================================================================================
Session ID: ${SESSION_ID}
Session Started: ${sessionStart}
Log Level: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLevel) || 'INFO'}
================================================================================

`;

if (fileLoggingEnabled) {
    try {
        fs.writeFileSync(LOG_FILE, sessionHeader);
        console.log(`Log file created: ${LOG_FILE}`);
    } catch (error) {
        console.error('Failed to initialize log file:', error.message);
        fileLoggingEnabled = false;
    }
}

/**
 * Get current timestamp for log entries
 * @returns {string} Timestamp string
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format data for logging
 * @param {Object} data - Data to format
 * @returns {string} Formatted string
 */
function formatData(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (data instanceof Error) {
        return `\n    Error: ${data.message}${data.stack ? '\n    Stack: ' + data.stack.split('\n').join('\n    ') : ''}`;
    }
    try {
        const str = JSON.stringify(data, null, 2);
        return '\n    ' + str.split('\n').join('\n    ');
    } catch {
        return String(data);
    }
}

/**
 * Write a log entry to file
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function writeToFile(level, message, data = null) {
    if (!fileLoggingEnabled) return;
    
    const timestamp = getTimestamp();
    const paddedLevel = level.padEnd(5);
    let logLine = `[${timestamp}] [${paddedLevel}] ${message}`;
    
    if (data) {
        logLine += formatData(data);
    }
    
    logLine += '\n';
    
    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (error) {
        // Only log once to avoid spam
        if (fileLoggingEnabled) {
            console.error('Failed to write to log file:', error.message);
            fileLoggingEnabled = false;
        }
    }
}

/**
 * Format message for console output
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted message
 */
function formatConsoleMessage(level, message) {
    const timestamp = getTimestamp();
    const levelColors = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[level] || reset;
    
    return `[${timestamp}] ${color}[${level}]${reset} ${message}`;
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
export function debug(message, data = null) {
    writeToFile('DEBUG', message, data);
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.log(formatConsoleMessage('DEBUG', message));
        if (data) console.log(data);
    }
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
export function info(message, data = null) {
    writeToFile('INFO', message, data);
    if (currentLevel <= LOG_LEVELS.INFO) {
        console.log(formatConsoleMessage('INFO', message));
        if (data) console.log(data);
    }
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
export function warn(message, data = null) {
    writeToFile('WARN', message, data);
    if (currentLevel <= LOG_LEVELS.WARN) {
        console.warn(formatConsoleMessage('WARN', message));
        if (data) console.warn(data);
    }
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Error|Object} error - Error object or additional data
 */
export function error(message, error = null) {
    writeToFile('ERROR', message, error);
    if (currentLevel <= LOG_LEVELS.ERROR) {
        console.error(formatConsoleMessage('ERROR', message));
        if (error) console.error(error);
    }
}


/**
 * Log a Canvas API request
 * @param {string} endpoint - API endpoint
 * @param {string} status - Request status
 * @param {Object} details - Additional details
 */
export function canvasApi(endpoint, status, details = null) {
    const message = `Canvas API: ${endpoint} - ${status}`;
    if (status === 'error') {
        error(message, details);
    } else {
        debug(message, details);
    }
}

/**
 * Log a Discord event
 * @param {string} event - Event name
 * @param {string} description - Event description
 * @param {Object} details - Additional details
 */
export function discord(event, description, details = null) {
    info(`Discord [${event}]: ${description}`, details);
}

/**
 * Log an assignment event
 * @param {string} courseId - Course ID
 * @param {string} action - Action performed
 * @param {string} assignmentName - Assignment name
 * @param {Object} details - Additional details
 */
export function assignment(courseId, action, assignmentName, details = null) {
    info(`[Course ${courseId}] ${action}: ${assignmentName}`, details);
}

/**
 * Log a reminder event
 * @param {string} type - Reminder type (assignment/custom)
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export function reminder(type, action, details = null) {
    info(`Reminder [${type}]: ${action}`, details);
}

/**
 * Log a command execution
 * @param {string} commandName - Command name
 * @param {string} userId - User ID
 * @param {Object} options - Command options
 */
export function command(commandName, userId, options = null) {
    info(`Command /${commandName} executed by ${userId}`, options);
}

/**
 * Log a button interaction
 * @param {string} buttonId - Button custom ID
 * @param {string} userId - User ID
 * @param {string} result - Interaction result
 */
export function button(buttonId, userId, result) {
    info(`Button [${buttonId}] clicked by ${userId}: ${result}`);
}

/**
 * Log a section separator
 * @param {string} title - Section title
 */
export function section(title) {
    if (!fileLoggingEnabled) return;
    
    const line = '-'.repeat(60);
    const entry = `\n${line}\n${title}\n${line}\n`;
    try {
        fs.appendFileSync(LOG_FILE, entry);
    } catch (err) {
        // Ignore
    }
}

/**
 * Get the log file path
 * @returns {string} Path to the log file
 */
export function getLogFilePath() {
    return LOG_FILE;
}

/**
 * Get the session ID
 * @returns {string} Current session ID
 */
export function getSessionId() {
    return SESSION_ID;
}

// Default export for convenience
export default {
    debug,
    info,
    warn,
    error,
    canvasApi,
    discord,
    assignment,
    reminder,
    command,
    button,
    section,
    getLogFilePath,
    getSessionId
};
