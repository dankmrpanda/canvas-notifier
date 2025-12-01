/**
 * Discord Embed Builder Utilities
 * Creates consistent embeds for various notification types
 * Includes button components for assignment completion tracking
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { stripHtml } from 'string-strip-html';
import { COLORS, getEmbedColor, REMINDER_LABELS } from '../../config.js';

/**
 * Create a Discord timestamp string
 * @param {Date|string} date - Date to format
 * @param {string} format - Discord timestamp format (F, R, etc.)
 * @returns {string} Discord timestamp string
 */
function formatTimestamp(date, format = 'F') {
    if (!date) return 'N/A';
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    if (isNaN(timestamp)) return 'N/A';
    return `<t:${timestamp}:${format}>`;
}

/**
 * Safely truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create done/undone buttons for an assignment
 * @param {number|string} assignmentId - Assignment ID for button custom_id
 * @param {string} courseId - Course ID for button custom_id
 * @returns {ActionRowBuilder} Action row with buttons
 */
export function createAssignmentButtons(assignmentId, courseId) {
    const doneButton = new ButtonBuilder()
        .setCustomId(`assignment_done:${courseId}:${assignmentId}`)
        .setLabel('✅ Done')
        .setStyle(ButtonStyle.Success);
    
    const undoneButton = new ButtonBuilder()
        .setCustomId(`assignment_undone:${courseId}:${assignmentId}`)
        .setLabel('🔄 Not Done')
        .setStyle(ButtonStyle.Secondary);
    
    return new ActionRowBuilder().addComponents(doneButton, undoneButton);
}

/**
 * Create embed for a new assignment notification
 * @param {Object} assignment - Assignment data
 * @returns {EmbedBuilder} Discord embed
 */
export function createNewAssignmentEmbed(assignment) {
    let description = 'No description available.';
    if (assignment.description) {
        try {
            description = stripHtml(assignment.description).result.trim() || 'No description available.';
        } catch {
            description = 'No description available.';
        }
    }
    
    const submissionTypes = Array.isArray(assignment.submissionTypes) && assignment.submissionTypes.length > 0
        ? assignment.submissionTypes.join(', ')
        : 'N/A';

    const embed = new EmbedBuilder()
        .setTitle(truncateText(assignment.name, 256))
        .setDescription(truncateText(description, 4096))
        .addFields(
            { name: 'Deadline', value: formatTimestamp(assignment.deadline), inline: true },
            { name: 'Points', value: String(assignment.pointsPossible ?? 'N/A'), inline: true },
            { name: 'Submission Type', value: truncateText(submissionTypes, 1024), inline: true }
        )
        .setTimestamp()
        .setColor(COLORS.newAssignment);

    if (assignment.htmlUrl) {
        embed.addFields({ name: 'Link', value: `[View Assignment](${assignment.htmlUrl})`, inline: false });
    }
    
    // Add instruction for buttons
    embed.setFooter({ text: 'Click "Done" when you complete this assignment to stop reminders' });

    return embed;
}

/**
 * Create embed and buttons for a new assignment
 * @param {Object} assignment - Assignment data
 * @returns {{embed: EmbedBuilder, components: ActionRowBuilder[]}} Embed and components
 */
export function createNewAssignmentMessage(assignment) {
    const embed = createNewAssignmentEmbed(assignment);
    const buttons = createAssignmentButtons(assignment.id, assignment.courseId);
    
    return {
        embed,
        components: [buttons]
    };
}

/**
 * Create embed for an updated assignment notification
 * @param {Object} assignment - Assignment data
 * @returns {EmbedBuilder} Discord embed
 */
export function createUpdatedAssignmentEmbed(assignment) {
    const embed = new EmbedBuilder()
        .setTitle(truncateText(`📝 Updated: ${assignment.name}`, 256))
        .setDescription('This assignment has been modified.')
        .addFields(
            { name: 'New Deadline', value: formatTimestamp(assignment.deadline), inline: true },
            { name: 'Points', value: String(assignment.pointsPossible ?? 'N/A'), inline: true }
        )
        .setTimestamp()
        .setColor(COLORS.updatedAssignment)
        .setFooter({ text: 'Click "Done" when you complete this assignment to stop reminders' });

    if (assignment.htmlUrl) {
        embed.addFields({ name: 'Link', value: `[View Assignment](${assignment.htmlUrl})`, inline: false });
    }

    return embed;
}

/**
 * Create embed and buttons for an updated assignment
 * @param {Object} assignment - Assignment data
 * @returns {{embed: EmbedBuilder, components: ActionRowBuilder[]}} Embed and components
 */
export function createUpdatedAssignmentMessage(assignment) {
    const embed = createUpdatedAssignmentEmbed(assignment);
    const buttons = createAssignmentButtons(assignment.id, assignment.courseId);
    
    return {
        embed,
        components: [buttons]
    };
}

/**
 * Create embed for an assignment reminder
 * @param {Object} assignment - Assignment data
 * @param {number} hoursLeft - Hours until deadline
 * @returns {EmbedBuilder} Discord embed
 */
export function createAssignmentReminderEmbed(assignment, hoursLeft) {
    const submissionTypes = Array.isArray(assignment.submissionTypes) && assignment.submissionTypes.length > 0
        ? assignment.submissionTypes.join(', ')
        : 'N/A';

    const embed = new EmbedBuilder()
        .setTitle(truncateText(`⏰ Reminder: ${assignment.name}`, 256))
        .setDescription('Don\'t forget about this upcoming assignment!')
        .addFields(
            { name: 'Deadline', value: formatTimestamp(assignment.deadline), inline: true },
            { name: 'Time Left', value: formatTimestamp(assignment.deadline, 'R'), inline: true },
            { name: 'Points', value: String(assignment.pointsPossible ?? 'N/A'), inline: true },
            { name: 'Submission Type', value: truncateText(submissionTypes, 1024), inline: true }
        )
        .setTimestamp()
        .setColor(getEmbedColor(hoursLeft))
        .setFooter({ text: 'Click "Done" to mark complete and stop reminders' });

    if (assignment.htmlUrl) {
        embed.addFields({ name: 'Link', value: `[View Assignment](${assignment.htmlUrl})`, inline: false });
    }

    return embed;
}

/**
 * Create embed and buttons for an assignment reminder
 * @param {Object} assignment - Assignment data
 * @param {number} hoursLeft - Hours until deadline
 * @returns {{embed: EmbedBuilder, components: ActionRowBuilder[]}} Embed and components
 */
export function createAssignmentReminderMessage(assignment, hoursLeft) {
    const embed = createAssignmentReminderEmbed(assignment, hoursLeft);
    const buttons = createAssignmentButtons(assignment.id, assignment.courseId);
    
    return {
        embed,
        components: [buttons]
    };
}

/**
 * Create embed for a custom reminder
 * @param {Object} reminder - Reminder data
 * @param {number} hoursLeft - Hours until reminder time
 * @returns {EmbedBuilder} Discord embed
 */
export function createCustomReminderEmbed(reminder, hoursLeft) {
    return new EmbedBuilder()
        .setTitle(truncateText(`🔔 Reminder: ${reminder.title}`, 256))
        .addFields(
            { name: 'Scheduled For', value: formatTimestamp(reminder.date), inline: true },
            { name: 'Time Left', value: formatTimestamp(reminder.date, 'R'), inline: true },
            { name: 'Description', value: truncateText(reminder.description || 'No description provided.', 1024), inline: false }
        )
        .setTimestamp()
        .setColor(getEmbedColor(hoursLeft));
}

/**
 * Get the reminder label for display
 * @param {number} reminderKey - The reminder threshold key
 * @param {string} type - 'assignment' or 'custom'
 * @returns {string} Human-readable label
 */
export function getReminderLabel(reminderKey, type = 'assignment') {
    return REMINDER_LABELS[type]?.[reminderKey] || 'Reminder';
}
