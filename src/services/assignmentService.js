/**
 * Assignment Service
 * Handles checking for new/updated assignments and sending notifications
 * Creates assignment-specific roles and assigns them to course members
 * Supports automatic course discovery from Canvas
 */
import { COURSES, AUTO_DISCOVER, GUILD_ID, setCourses, TIMING } from '../../config.js';
import { fetchAssignmentsForCourse, transformAssignment, hasAssignmentChanged } from '../utils/canvasApi.js';
import {
    loadCourseData,
    saveCourseData,
    saveCourseConfigs,
    loadCourseConfigs,
    getRolesChannelForCategory,
    updateRolesChannelForCategory
} from '../utils/dataStore.js';
import { createNewAssignmentMessage, createUpdatedAssignmentMessage } from '../utils/embedBuilder.js';
import {
    getOrCreateAssignmentRole,
    assignRoleToCourseMembersSync
} from '../utils/roleManager.js';
import { setupGuildFromCanvas, verifyGuildSetup, getOrCreateRolesChannel, addCourseRoleEmbed, cleanupStaleCourses } from '../utils/guildSetup.js';
import { getChannel } from '../utils/helpers.js';
import log from '../utils/logger.js';



/**
 * Initialize courses from Canvas (auto-discovery mode)
 * Sets up roles, categories, and channels automatically
 * @param {Client} client - Discord client
 * @returns {Promise<boolean>} Success status
 */
export async function initializeCoursesFromCanvas(client) {
    if (!AUTO_DISCOVER) {
        log.info('Auto-discovery disabled, using manual course configuration');
        return true;
    }

    if (!GUILD_ID) {
        log.error('GUILD_ID required for auto-discovery mode');
        return false;
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        try {
            await client.guilds.fetch(GUILD_ID);
        } catch (error) {
            log.error(`Failed to fetch guild ${GUILD_ID}`, error);
            return false;
        }
    }

    const targetGuild = client.guilds.cache.get(GUILD_ID);
    if (!targetGuild) {
        log.error(`Guild ${GUILD_ID} not found`);
        return false;
    }

    // Check for existing saved configuration
    const savedConfigs = await loadCourseConfigs();

    if (savedConfigs && savedConfigs.length > 0) {
        log.info('Found saved course configurations, verifying...');

        // Verify and repair if needed
        const verifiedConfigs = await verifyGuildSetup(targetGuild, savedConfigs);
        setCourses(verifiedConfigs);
        await saveCourseConfigs(verifiedConfigs);

        log.info(`Loaded ${verifiedConfigs.length} courses from saved configuration`);
        return true;
    }

    // No saved config, run full setup
    log.info('No saved configuration found, running full Canvas discovery...');

    try {
        const courseConfigs = await setupGuildFromCanvas(targetGuild);

        if (courseConfigs.length === 0) {
            log.info('No courses with assignments found in Canvas');
            return true;
        }

        // Update global COURSES and save to disk
        setCourses(courseConfigs);
        await saveCourseConfigs(courseConfigs);

        log.info(`Initialized ${courseConfigs.length} courses from Canvas`);
        return true;
    } catch (error) {
        log.error('Failed to initialize courses from Canvas', error);
        return false;
    }
}


/**
 * Refresh course list from Canvas
 * Adds new courses, removes stale courses, cleans up empty categories
 * Creates roles channels for new terms and adds role embeds
 * Uses saved roles channel IDs when available
 * @param {Client} client - Discord client
 */
export async function refreshCoursesFromCanvas(client) {
    if (!AUTO_DISCOVER || !GUILD_ID) {
        return;
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        log.error('Guild not found for course refresh');
        return;
    }

    log.info('Refreshing course list from Canvas...');

    try {
        const newConfigs = await setupGuildFromCanvas(guild, { sendRoleEmbeds: false });

        // Get current Canvas course IDs for cleanup
        const currentCanvasCourseIds = newConfigs.map(c => c.courseId);

        // Clean up courses that no longer exist in Canvas
        const { removedCourses, removedCategories } = await cleanupStaleCourses(guild, currentCanvasCourseIds);
        if (removedCourses > 0) {
            log.info(`Cleaned up ${removedCourses} stale courses and ${removedCategories} empty categories`);
        }

        // Reload configs after cleanup
        const currentConfigs = await loadCourseConfigs() || [];

        // Merge with existing configs (keep existing, add new)
        const existingIds = new Set(currentConfigs.map(c => c.courseId));
        const mergedConfigs = [...currentConfigs];
        const addedCourses = [];

        for (const config of newConfigs) {
            if (!existingIds.has(config.courseId)) {
                mergedConfigs.push(config);
                addedCourses.push(config);
                log.info(`Added new course: ${config.courseCode}`);
            }
        }

        // For newly added courses, ensure roles channel exists and add role embeds
        if (addedCourses.length > 0) {
            // Group new courses by term/category
            const coursesByCategory = new Map();
            for (const course of addedCourses) {
                if (!course.categoryId) continue;

                if (!coursesByCategory.has(course.categoryId)) {
                    coursesByCategory.set(course.categoryId, []);
                }
                coursesByCategory.get(course.categoryId).push(course);
            }

            // For each category with new courses, ensure roles channel exists and add embeds
            for (const [categoryId, courses] of coursesByCategory) {
                const category = guild.channels.cache.get(categoryId);
                if (!category) {
                    log.warn(`Category ${categoryId} not found for creating roles channel`);
                    continue;
                }

                // First, check if we have a saved roles channel ID for this category
                const savedRolesChannelId = await getRolesChannelForCategory(categoryId);
                let rolesChannel = null;

                if (savedRolesChannelId) {
                    // Try to get the channel from cache or fetch it
                    rolesChannel = guild.channels.cache.get(savedRolesChannelId);
                    if (!rolesChannel) {
                        try {
                            rolesChannel = await guild.channels.fetch(savedRolesChannelId);
                        } catch {
                            log.debug(`Saved roles channel ${savedRolesChannelId} not found, creating new one`);
                        }
                    }
                }

                // If no saved channel found, get or create one
                if (!rolesChannel) {
                    rolesChannel = await getOrCreateRolesChannel(guild, category);
                    if (rolesChannel) {
                        // Save the roles channel ID for all courses in this category
                        await updateRolesChannelForCategory(categoryId, rolesChannel.id);

                        // Also update the new course configs
                        for (const course of courses) {
                            course.rolesChannelId = rolesChannel.id;
                        }
                    }
                }

                if (!rolesChannel) {
                    log.error(`Failed to create roles channel for category ${category.name}`);
                    continue;
                }

                // Add role embeds for each new course
                for (const course of courses) {
                    await addCourseRoleEmbed(rolesChannel, course);
                }
            }
        }

        setCourses(mergedConfigs);
        await saveCourseConfigs(mergedConfigs);

        log.info(`Course refresh complete. Total courses: ${mergedConfigs.length}, New: ${addedCourses.length}, Removed: ${removedCourses}`);
    } catch (error) {
        log.error('Failed to refresh courses', error);
    }
}

/**
 * Check for new and updated assignments for a single course
 * @param {Client} client - Discord client instance
 * @param {Object} courseConfig - Course configuration {courseId, channelId, roleId}
 */
async function checkCourseAssignments(client, courseConfig) {
    const { courseId, channelId, roleId } = courseConfig;

    const channel = await getChannel(client, channelId);

    if (!channel) {
        log.error(`Channel not found for course ${courseId}. Check channelId: ${channelId}`);
        return;
    }

    if (!channel.isTextBased()) {
        log.error(`Channel ${channelId} is not a text channel.`);
        return;
    }

    const guild = channel.guild;
    if (!guild) {
        log.error(`Could not get guild from channel ${channelId}`);
        return;
    }

    const canvasAssignments = await fetchAssignmentsForCourse(courseId);

    if (!Array.isArray(canvasAssignments)) {
        log.error(`Invalid response from Canvas API for course ${courseId}`);
        return;
    }

    if (canvasAssignments.length === 0) {
        log.debug(`No upcoming assignments for course ${courseId}`);
        return;
    }

    const now = new Date();
    const data = await loadCourseData(courseId);

    if (!Array.isArray(data.assignments)) {
        data.assignments = [];
    }

    const canvasAssignmentIds = new Set(canvasAssignments.map(a => a.id));

    // Remove outdated assignments and their roles
    const assignmentsToRemove = data.assignments.filter(stored => {
        if (!canvasAssignmentIds.has(stored.id)) {
            return true;
        }
        if (stored.deadline && new Date(stored.deadline) <= now) {
            return true;
        }
        return false;
    });

    // Delete roles and messages for removed assignments
    for (const assignment of assignmentsToRemove) {
        log.assignment(courseId, 'Removing', assignment.name);

        // Delete the message for this assignment
        if (assignment.messageId) {
            try {
                const message = await channel.messages.fetch(assignment.messageId);
                await message.delete();
                log.assignment(courseId, 'Deleted message', `${assignment.messageId} for "${assignment.name}"`);
            } catch (error) {
                log.error(`Failed to delete message ${assignment.messageId}`, error);
            }
        }

        // Delete the role
        if (assignment.roleId) {
            try {
                const role = guild.roles.cache.get(assignment.roleId);
                if (role) {
                    await role.delete('Assignment completed or removed');
                    log.assignment(courseId, 'Deleted role for', assignment.name);
                }
            } catch (error) {
                log.error(`Failed to delete role`, error);
            }
        }
    }

    data.assignments = data.assignments.filter(stored =>
        canvasAssignmentIds.has(stored.id) &&
        (!stored.deadline || new Date(stored.deadline) > now)
    );

    // Process each Canvas assignment
    for (const canvasAssignment of canvasAssignments) {
        if (!canvasAssignment.due_at) {
            continue;
        }

        const dueDate = new Date(canvasAssignment.due_at);

        if (dueDate <= now) {
            continue;
        }

        const existingIndex = data.assignments.findIndex(a => a.id === canvasAssignment.id);

        if (existingIndex >= 0) {
            const existing = data.assignments[existingIndex];

            if (hasAssignmentChanged(existing, canvasAssignment)) {
                log.assignment(courseId, 'Updated', canvasAssignment.name);

                const oldDeadline = existing.deadline ? new Date(existing.deadline).getTime() : 0;
                const newDeadline = new Date(canvasAssignment.due_at).getTime();
                const deadlineChanged = oldDeadline !== newDeadline;

                // Keep existing role
                data.assignments[existingIndex] = {
                    ...transformAssignment(canvasAssignment, courseId),
                    roleId: existing.roleId,
                    remindersSent: deadlineChanged ? [] : (existing.remindersSent || [])
                };

                try {
                    // Delete previous message if it exists
                    if (existing.messageId) {
                        try {
                            const oldMessage = await channel.messages.fetch(existing.messageId);
                            await oldMessage.delete();
                            log.assignment(courseId, 'Deleted previous message for', canvasAssignment.name);
                        } catch (error) {
                            log.error(`Failed to delete previous message ${existing.messageId}`, error);
                        }
                    }

                    const { embed, components } = createUpdatedAssignmentMessage(data.assignments[existingIndex]);

                    // Ping the assignment role if it exists
                    const rolePing = existing.roleId ? `<@&${existing.roleId}> ` : '';

                    const message = await channel.send({
                        content: `${rolePing}📝 Assignment "${canvasAssignment.name}" has been updated!`,
                        embeds: [embed],
                        components
                    });

                    // Store only the latest message ID
                    data.assignments[existingIndex].messageId = message.id;

                    log.discord('messageSend', `Sent update notification for ${canvasAssignment.name}`, { courseId, channelId });
                } catch (error) {
                    log.error(`[Course ${courseId}] Failed to send update notification`, error);
                }
            }
        } else {
            // New assignment
            log.assignment(courseId, 'New', canvasAssignment.name);

            const newAssignment = transformAssignment(canvasAssignment, courseId);

            // Create assignment role
            const assignmentRole = await getOrCreateAssignmentRole(guild, newAssignment);

            if (assignmentRole) {
                newAssignment.roleId = assignmentRole.id;

                // Assign role to all members with the course role
                if (roleId) {
                    await assignRoleToCourseMembersSync(guild, assignmentRole, roleId);
                }
            }

            data.assignments.push(newAssignment);

            try {
                const { embed, components } = createNewAssignmentMessage(newAssignment);

                // Ping the assignment role (not the course role)
                const rolePing = assignmentRole ? `<@&${assignmentRole.id}> ` : '';

                const message = await channel.send({
                    content: `${rolePing}📚 A new assignment has been posted!`,
                    embeds: [embed],
                    components
                });

                // Store only the latest message ID
                newAssignment.messageId = message.id;

                log.discord('messageSend', `Sent new assignment notification for ${canvasAssignment.name}`, { courseId, channelId });
            } catch (error) {
                log.error(`[Course ${courseId}] Failed to send notification`, error);
            }
        }
    }

    await saveCourseData(courseId, data);
}

/**
 * Check for new and updated assignments across all configured courses
 * @param {Client} client - Discord client instance
 */
export async function checkForNewAssignments(client) {
    if (COURSES.length === 0) {
        log.debug('No courses configured, skipping assignment check');
        return;
    }

    for (const courseConfig of COURSES) {
        try {
            await checkCourseAssignments(client, courseConfig);
        } catch (error) {
            log.error(`Error checking course ${courseConfig.courseId}`, error);
        }
    }
}

/**
 * Start the course refresh loop (for auto-discovery mode)
 * @param {Client} client - Discord client
 */
export function startCourseRefreshLoop(client) {
    if (!AUTO_DISCOVER) {
        return;
    }

    setInterval(async () => {
        try {
            await refreshCoursesFromCanvas(client);
        } catch (error) {
            log.error('Error during course refresh', error);
        }
    }, TIMING.courseRefreshInterval);

    log.info(`Course refresh scheduled (interval: ${TIMING.courseRefreshInterval / 60000} minutes)`);
}

export { checkCourseAssignments };
