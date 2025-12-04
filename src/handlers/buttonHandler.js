/**
 * Button Handler
 * Handles button interactions for assignment completion tracking and course role selection
 */
import { loadCourseData } from '../utils/dataStore.js';
import { removeAssignmentRole, addAssignmentRole } from '../utils/roleManager.js';
import { syncAssignmentRoles } from '../utils/guildSetup.js';
import { COURSES } from '../../config.js';
import log from '../utils/logger.js';

/**
 * Handle assignment done/undone button clicks
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
export async function handleAssignmentButton(interaction) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    
    if (parts.length < 3) {
        await interaction.reply({
            content: '❌ Invalid button data.',
            ephemeral: true
        });
        return;
    }
    
    const action = parts[0]; // 'assignment_done' or 'assignment_undone'
    const courseId = parts[1];
    const assignmentId = parts[2];
    
    // Get the guild and member
    const guild = interaction.guild;
    const member = interaction.member;
    
    if (!guild || !member) {
        await interaction.reply({
            content: '❌ This button only works in a server.',
            ephemeral: true
        });
        return;
    }
    
    // Load course data to find the assignment
    const data = await loadCourseData(courseId);
    const assignment = data.assignments.find(a => String(a.id) === String(assignmentId));
    
    if (!assignment) {
        await interaction.reply({
            content: '❌ Assignment not found. It may have been removed.',
            ephemeral: true
        });
        return;
    }
    
    if (!assignment.roleId) {
        await interaction.reply({
            content: '❌ No role associated with this assignment.',
            ephemeral: true
        });
        return;
    }
    
    // Get the assignment role
    const role = guild.roles.cache.get(assignment.roleId);
    
    if (!role) {
        await interaction.reply({
            content: '❌ Assignment role not found. It may have been deleted.',
            ephemeral: true
        });
        return;
    }
    
    // Handle the action
    if (action === 'assignment_done') {
        // Check if user has the role
        if (!member.roles.cache.has(role.id)) {
            await interaction.reply({
                content: `ℹ️ You've already marked "${assignment.name}" as done.`,
                ephemeral: true
            });
            return;
        }
        
        // Remove the role
        const success = await removeAssignmentRole(member, role);
        
        if (success) {
            log.button(customId, member.user.id, `Marked "${assignment.name}" as done`);
            await interaction.reply({
                content: `✅ Marked "${assignment.name}" as done! You won't receive further reminders for this assignment.`,
                ephemeral: true
            });
        } else {
            log.button(customId, member.user.id, `Failed to mark "${assignment.name}" as done`);
            await interaction.reply({
                content: '❌ Failed to update your status. Please try again.',
                ephemeral: true
            });
        }
        return;
    } else if (action === 'assignment_undone') {
        // Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            await interaction.reply({
                content: `ℹ️ "${assignment.name}" is already marked as not done.`,
                ephemeral: true
            });
            return;
        }
        
        // Add the role back
        const success = await addAssignmentRole(member, role);
        
        if (success) {
            log.button(customId, member.user.id, `Marked "${assignment.name}" as not done`);
            await interaction.reply({
                content: `🔄 Marked "${assignment.name}" as not done. You'll receive reminders again.`,
                ephemeral: true
            });
        } else {
            log.button(customId, member.user.id, `Failed to mark "${assignment.name}" as not done`);
            await interaction.reply({
                content: '❌ Failed to update your status. Please try again.',
                ephemeral: true
            });
        }
        return;
    }
    
    await interaction.reply({
        content: '❌ Unknown action.',
        ephemeral: true
    });
}


/**
 * Handle course role toggle button clicks
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
export async function handleCourseRoleToggle(interaction) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    
    if (parts.length < 3) {
        await interaction.reply({
            content: '❌ Invalid button data.',
            ephemeral: true
        });
        return;
    }
    
    const courseId = parts[1];
    const roleId = parts[2];
    
    const guild = interaction.guild;
    const member = interaction.member;
    
    if (!guild || !member) {
        await interaction.reply({
            content: '❌ This button only works in a server.',
            ephemeral: true
        });
        return;
    }
    
    // Get the course role
    const courseRole = guild.roles.cache.get(roleId);
    
    if (!courseRole) {
        await interaction.reply({
            content: '❌ Course role not found. It may have been deleted.',
            ephemeral: true
        });
        return;
    }
    
    // Find course config
    const courseConfig = COURSES.find(c => c.courseId === courseId || c.roleId === roleId);
    
    // Load course data for assignment roles
    let assignments = [];
    try {
        const data = await loadCourseData(courseId);
        assignments = data.assignments || [];
    } catch (e) {
        // Course data might not exist yet
    }
    
    // Defer reply since role operations might take time
    await interaction.deferReply({ ephemeral: true });
    
    try {
        if (member.roles.cache.has(courseRole.id)) {
            // Remove course role
            await member.roles.remove(courseRole, 'User left course via role selection');
            
            // Remove all assignment roles for this course
            await syncAssignmentRoles(member, roleId, false, assignments);
            
            log.button(customId, member.user.id, `Left course ${courseConfig?.courseCode || courseId}`);
            
            return interaction.editReply({
                content: `✅ You have left **${courseConfig?.courseCode || 'the course'}**.\n\n• You no longer have access to the course channel.\n• You won't receive assignment notifications.`
            });
        } else {
            // Add course role
            await member.roles.add(courseRole, 'User joined course via role selection');
            
            // Add all assignment roles for this course
            await syncAssignmentRoles(member, roleId, true, assignments);
            
            log.button(customId, member.user.id, `Joined course ${courseConfig?.courseCode || courseId}`);
            
            return interaction.editReply({
                content: `✅ You have joined **${courseConfig?.courseCode || 'the course'}**!\n\n• You now have access to the course channel.\n• You'll receive assignment notifications and reminders.`
            });
        }
    } catch (error) {
        log.error(`Failed to toggle course role for ${member.user.tag}`, error);
        return interaction.editReply({
            content: '❌ Failed to update your role. Please try again or contact an administrator.'
        });
    }
}
