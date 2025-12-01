/**
 * Button Handler
 * Handles button interactions for assignment completion tracking
 */
import { loadCourseData } from '../utils/dataStore.js';
import { removeAssignmentRole, addAssignmentRole } from '../utils/roleManager.js';

/**
 * Handle assignment done/undone button clicks
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
export async function handleAssignmentButton(interaction) {
    const customId = interaction.customId;
    const parts = customId.split(':');
    
    if (parts.length < 3) {
        return interaction.reply({
            content: '❌ Invalid button data.',
            ephemeral: true
        });
    }
    
    const action = parts[0]; // 'assignment_done' or 'assignment_undone'
    const courseId = parts[1];
    const assignmentId = parts[2];
    
    // Get the guild and member
    const guild = interaction.guild;
    const member = interaction.member;
    
    if (!guild || !member) {
        return interaction.reply({
            content: '❌ This button only works in a server.',
            ephemeral: true
        });
    }
    
    // Load course data to find the assignment
    const data = await loadCourseData(courseId);
    const assignment = data.assignments.find(a => String(a.id) === String(assignmentId));
    
    if (!assignment) {
        return interaction.reply({
            content: '❌ Assignment not found. It may have been removed.',
            ephemeral: true
        });
    }
    
    if (!assignment.roleId) {
        return interaction.reply({
            content: '❌ No role associated with this assignment.',
            ephemeral: true
        });
    }
    
    // Get the assignment role
    const role = guild.roles.cache.get(assignment.roleId);
    
    if (!role) {
        return interaction.reply({
            content: '❌ Assignment role not found. It may have been deleted.',
            ephemeral: true
        });
    }
    
    // Handle the action
    if (action === 'assignment_done') {
        // Check if user has the role
        if (!member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: `ℹ️ You've already marked "${assignment.name}" as done.`,
                ephemeral: true
            });
        }
        
        // Remove the role
        const success = await removeAssignmentRole(member, role);
        
        if (success) {
            return interaction.reply({
                content: `✅ Marked "${assignment.name}" as done! You won't receive further reminders for this assignment.`,
                ephemeral: true
            });
        } else {
            return interaction.reply({
                content: '❌ Failed to update your status. Please try again.',
                ephemeral: true
            });
        }
    } else if (action === 'assignment_undone') {
        // Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: `ℹ️ "${assignment.name}" is already marked as not done.`,
                ephemeral: true
            });
        }
        
        // Add the role back
        const success = await addAssignmentRole(member, role);
        
        if (success) {
            return interaction.reply({
                content: `🔄 Marked "${assignment.name}" as not done. You'll receive reminders again.`,
                ephemeral: true
            });
        } else {
            return interaction.reply({
                content: '❌ Failed to update your status. Please try again.',
                ephemeral: true
            });
        }
    }
    
    return interaction.reply({
        content: '❌ Unknown action.',
        ephemeral: true
    });
}
