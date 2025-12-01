/**
 * Assignment Service
 * Handles checking for new/updated assignments and sending notifications
 * Creates assignment-specific roles and assigns them to course members
 */
import { COURSES } from '../../config.js';
import { fetchAssignmentsForCourse, transformAssignment, hasAssignmentChanged } from '../utils/canvasApi.js';
import { loadCourseData, saveCourseData } from '../utils/dataStore.js';
import { createNewAssignmentMessage, createUpdatedAssignmentMessage } from '../utils/embedBuilder.js';
import { 
    getOrCreateAssignmentRole, 
    assignRoleToCourseMembersSync
} from '../utils/roleManager.js';

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
            console.error(`Failed to fetch channel ${channelId}:`, error.message);
            return null;
        }
    }
    
    return channel;
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
        console.error(`Channel not found for course ${courseId}. Check channelId: ${channelId}`);
        return;
    }
    
    if (!channel.isTextBased()) {
        console.error(`Channel ${channelId} is not a text channel.`);
        return;
    }
    
    const guild = channel.guild;
    if (!guild) {
        console.error(`Could not get guild from channel ${channelId}`);
        return;
    }
    
    const canvasAssignments = await fetchAssignmentsForCourse(courseId);
    
    if (!Array.isArray(canvasAssignments)) {
        console.error(`Invalid response from Canvas API for course ${courseId}`);
        return;
    }
    
    if (canvasAssignments.length === 0) {
        console.log(`No upcoming assignments for course ${courseId}`);
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
    
    // Delete roles for removed assignments
    for (const assignment of assignmentsToRemove) {
        console.log(`[Course ${courseId}] Removing: ${assignment.name}`);
        if (assignment.roleId) {
            try {
                const role = guild.roles.cache.get(assignment.roleId);
                if (role) {
                    await role.delete('Assignment completed or removed');
                    console.log(`[Course ${courseId}] Deleted role for: ${assignment.name}`);
                }
            } catch (error) {
                console.error(`Failed to delete role:`, error.message);
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
                console.log(`[Course ${courseId}] Assignment updated: ${canvasAssignment.name}`);
                
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
                    const { embed, components } = createUpdatedAssignmentMessage(data.assignments[existingIndex]);
                    
                    // Ping the assignment role if it exists
                    const rolePing = existing.roleId ? `<@&${existing.roleId}> ` : '';
                    
                    await channel.send({
                        content: `${rolePing}📝 Assignment "${canvasAssignment.name}" has been updated!`,
                        embeds: [embed],
                        components
                    });
                } catch (error) {
                    console.error(`[Course ${courseId}] Failed to send update notification:`, error.message);
                }
            }
        } else {
            // New assignment
            console.log(`[Course ${courseId}] New assignment: ${canvasAssignment.name}`);
            
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
                
                await channel.send({
                    content: `${rolePing}📚 A new assignment has been posted!`,
                    embeds: [embed],
                    components
                });
            } catch (error) {
                console.error(`[Course ${courseId}] Failed to send notification:`, error.message);
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
    for (const courseConfig of COURSES) {
        try {
            await checkCourseAssignments(client, courseConfig);
        } catch (error) {
            console.error(`Error checking course ${courseConfig.courseId}:`, error.message);
        }
    }
}

export { checkCourseAssignments };
