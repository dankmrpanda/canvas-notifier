/**
 * Role Update Handler
 * Handles guildMemberUpdate events to sync assignment roles when course roles change
 */
import { COURSES } from '../../config.js';
import { loadCourseData } from '../utils/dataStore.js';
import { syncAssignmentRoles } from '../utils/guildSetup.js';
import log from '../utils/logger.js';

/**
 * Handle guildMemberUpdate event
 * Syncs assignment roles when a course role is added or removed
 * @param {GuildMember} oldMember - Member before update
 * @param {GuildMember} newMember - Member after update
 */
export async function handleRoleUpdate(oldMember, newMember) {
    // Get the roles that changed
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    
    // Find added roles
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    
    // Find removed roles
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
    
    // Check if any course roles were added
    for (const [roleId, role] of addedRoles) {
        const courseConfig = COURSES.find(c => c.roleId === roleId);
        if (courseConfig) {
            log.info(`Course role "${role.name}" added to ${newMember.user.tag}`);
            
            try {
                const data = await loadCourseData(courseConfig.courseId);
                const assignments = data.assignments || [];
                
                if (assignments.length > 0) {
                    await syncAssignmentRoles(newMember, roleId, true, assignments);
                }
            } catch (error) {
                log.error(`Failed to sync assignment roles for ${newMember.user.tag}`, error);
            }
        }
    }
    
    // Check if any course roles were removed
    for (const [roleId, role] of removedRoles) {
        const courseConfig = COURSES.find(c => c.roleId === roleId);
        if (courseConfig) {
            log.info(`Course role "${role.name}" removed from ${newMember.user.tag}`);
            
            try {
                const data = await loadCourseData(courseConfig.courseId);
                const assignments = data.assignments || [];
                
                if (assignments.length > 0) {
                    await syncAssignmentRoles(newMember, roleId, false, assignments);
                }
            } catch (error) {
                log.error(`Failed to sync assignment roles for ${newMember.user.tag}`, error);
            }
        }
    }
}
