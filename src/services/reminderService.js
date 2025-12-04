/**
 * Reminder Service
 * Handles checking and sending reminders for assignments and custom reminders
 * Uses assignment-specific roles for pinging
 */
import { COURSES, getReminderKey, TIMING } from '../../config.js';
import { loadCourseData, saveCourseData, loadData, saveData } from '../utils/dataStore.js';
import {
    createAssignmentReminderMessage,
    createCustomReminderEmbed,
    getReminderLabel
} from '../utils/embedBuilder.js';
import log from '../utils/logger.js';

/**
 * Get channel with fallback to fetch if not in cache
 * @param {Client} client - Discord client
 * @param {string} channelId - Channel ID
 * @returns {Promise<import('discord.js').Channel|null>} Channel or null
 */
async function getChannel(client, channelId) {
    let channel = client.channels.cache.get(channelId);

    if (!channel) {
        try {
            channel = await client.channels.fetch(channelId);
        } catch (error) {
            log.error(`Failed to fetch channel ${channelId}`, error);
            return null;
        }
    }

    return channel;
}

/**
 * Check and send assignment reminders for a single course
 * @param {Client} client - Discord client instance
 * @param {Object} courseConfig - Course configuration
 */
async function checkCourseAssignmentReminders(client, courseConfig) {
    const { courseId, channelId } = courseConfig;

    const channel = await getChannel(client, channelId);
    if (!channel) {
        return;
    }

    const now = new Date();
    const data = await loadCourseData(courseId);
    let hasChanges = false;

    if (!Array.isArray(data.assignments)) {
        data.assignments = [];
        return;
    }

    for (let i = 0; i < data.assignments.length; i++) {
        const assignment = data.assignments[i];

        if (!assignment.deadline) {
            continue;
        }

        const deadline = new Date(assignment.deadline);

        if (isNaN(deadline.getTime())) {
            continue;
        }

        const hoursLeft = (deadline - now) / (1000 * 60 * 60);

        if (hoursLeft <= 0) {
            continue;
        }

        const reminderKey = getReminderKey(hoursLeft, 'assignment');

        if (reminderKey === null) {
            continue;
        }

        if (!Array.isArray(assignment.remindersSent)) {
            data.assignments[i].remindersSent = [];
        }

        if (data.assignments[i].remindersSent.includes(reminderKey)) {
            continue;
        }

        try {
            // Delete previous message if it exists
            if (data.assignments[i].messageId) {
                try {
                    const oldMessage = await channel.messages.fetch(data.assignments[i].messageId);
                    await oldMessage.delete();
                    log.reminder('assignment', `Deleted previous message for "${assignment.name}"`, { courseId, assignmentId: assignment.id });
                } catch (error) {
                    log.error(`Failed to delete previous message ${data.assignments[i].messageId}`, error);
                }
            }
            
            const { embed, components } = createAssignmentReminderMessage(assignment, hoursLeft);
            const label = getReminderLabel(reminderKey, 'assignment');
            
            // Ping the assignment role (only users who haven't marked done)
            const rolePing = assignment.roleId ? `<@&${assignment.roleId}> ` : '';

            const message = await channel.send({
                content: `${rolePing}⏰ ${label}!`,
                embeds: [embed],
                components
            });

            log.reminder('assignment', `Sent: ${label} for "${assignment.name}"`, { courseId, assignmentId: assignment.id });

            // Store only the latest message ID
            data.assignments[i].messageId = message.id;
            data.assignments[i].remindersSent.push(reminderKey);
            hasChanges = true;
        } catch (error) {
            log.error(`[Course ${courseId}] Failed to send reminder`, error);
        }
    }

    if (hasChanges) {
        await saveCourseData(courseId, data);
    }
}

/**
 * Check and send assignment reminders for all courses
 * @param {Client} client - Discord client instance
 */
export async function checkAssignmentReminders(client) {
    if (!COURSES || COURSES.length === 0) {
        return; // No courses configured yet
    }
    
    for (const courseConfig of COURSES) {
        try {
            await checkCourseAssignmentReminders(client, courseConfig);
        } catch (error) {
            log.error(`Error checking reminders for course ${courseConfig.courseId}`, error);
        }
    }
}

/**
 * Check and send custom reminders (global, uses first course's channel)
 * @param {Client} client - Discord client instance
 */
export async function checkCustomReminders(client) {
    if (!COURSES || COURSES.length === 0) {
        return; // No courses configured yet
    }
    
    const defaultConfig = COURSES[0];
    if (!defaultConfig || !defaultConfig.channelId) {
        log.debug('No default channel configured for custom reminders');
        return;
    }

    const channel = await getChannel(client, defaultConfig.channelId);
    if (!channel) {
        log.debug(`Custom reminder channel ${defaultConfig.channelId} not found`);
        return;
    }

    const now = new Date();
    const data = await loadData();
    let hasChanges = false;
    const indicesToRemove = new Set();

    if (!Array.isArray(data.reminders)) {
        data.reminders = [];
        return;
    }

    for (let i = 0; i < data.reminders.length; i++) {
        const reminder = data.reminders[i];

        if (!reminder.date) {
            indicesToRemove.add(i);
            continue;
        }

        const reminderDate = new Date(reminder.date);

        if (isNaN(reminderDate.getTime())) {
            indicesToRemove.add(i);
            continue;
        }

        const hoursLeft = (reminderDate - now) / (1000 * 60 * 60);

        if (hoursLeft < -1) {
            indicesToRemove.add(i);
            continue;
        }

        if (hoursLeft > 168) {
            continue;
        }

        const reminderKey = getReminderKey(hoursLeft, 'custom');

        if (reminderKey === null) {
            continue;
        }

        if (!Array.isArray(reminder.remindersSent)) {
            data.reminders[i].remindersSent = [];
        }

        if (data.reminders[i].remindersSent.includes(reminderKey)) {
            continue;
        }

        try {
            const embed = createCustomReminderEmbed(reminder, hoursLeft);
            const userPing = reminder.userId ? `<@${reminder.userId}> ` : '';
            const label = getReminderLabel(reminderKey, 'custom');

            await channel.send({
                content: `${userPing}🔔 ${label}!`,
                embeds: [embed]
            });

            log.reminder('custom', `Sent: ${label} for "${reminder.title}"`, { userId: reminder.userId });

            if (reminderKey === 0) {
                indicesToRemove.add(i);
            } else {
                data.reminders[i].remindersSent.push(reminderKey);
            }
            hasChanges = true;
        } catch (error) {
            log.error(`Failed to send custom reminder: ${reminder.title}`, error);
        }
    }

    if (indicesToRemove.size > 0) {
        const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
        for (const index of sortedIndices) {
            data.reminders.splice(index, 1);
        }
        hasChanges = true;
    }

    if (hasChanges) {
        await saveData(data);
    }
}

/**
 * Start the reminder check loop
 * @param {Client} client - Discord client instance
 */
export async function startReminderLoop(client) {
    const checkReminders = async () => {
        try {
            await checkAssignmentReminders(client);
            await checkCustomReminders(client);
        } catch (error) {
            log.error('Error during reminder check', error);
        }
    };

    await checkReminders();

    setInterval(checkReminders, TIMING.reminderCheckInterval);

    log.info(`Reminder check loop started (interval: ${TIMING.reminderCheckInterval / 1000}s)`);
}
