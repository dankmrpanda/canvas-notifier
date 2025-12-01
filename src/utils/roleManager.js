/**
 * Role Manager
 * Handles creation and management of assignment-specific roles
 */

/**
 * Generate a role name for an assignment
 * @param {Object} assignment - Assignment object
 * @returns {string} Role name (max 100 chars)
 */
export function generateRoleName(assignment) {
    const prefix = '📝';
    const name = assignment.name || 'Assignment';
    const maxLength = 100 - prefix.length - 1;
    const truncatedName = name.length > maxLength 
        ? name.substring(0, maxLength - 3) + '...'
        : name;
    return `${prefix} ${truncatedName}`;
}

/**
 * Create or get an assignment role
 * @param {Guild} guild - Discord guild
 * @param {Object} assignment - Assignment object
 * @returns {Promise<Role|null>} The role, or null if failed
 */
export async function getOrCreateAssignmentRole(guild, assignment) {
    const roleName = generateRoleName(assignment);
    
    // Check if role already exists
    let role = guild.roles.cache.find(r => r.name === roleName);
    
    if (role) {
        return role;
    }
    
    // Create new role
    try {
        role = await guild.roles.create({
            name: roleName,
            color: 0x5865F2, // Discord blurple
            mentionable: true,
            reason: `Assignment role for: ${assignment.name}`
        });
        
        console.log(`Created role: ${roleName}`);
        return role;
    } catch (error) {
        console.error(`Failed to create role "${roleName}":`, error.message);
        return null;
    }
}

/**
 * Assign a role to all members who have the course role
 * @param {Guild} guild - Discord guild
 * @param {Role} assignmentRole - The assignment role to give
 * @param {string} courseRoleId - The course role ID
 * @returns {Promise<number>} Number of members assigned
 */
export async function assignRoleToCourseMembersSync(guild, assignmentRole, courseRoleId) {
    if (!courseRoleId) {
        return 0;
    }
    
    let assignedCount = 0;
    
    try {
        // Fetch all members to ensure cache is populated
        await guild.members.fetch();
        
        const courseRole = guild.roles.cache.get(courseRoleId);
        if (!courseRole) {
            console.error(`Course role ${courseRoleId} not found`);
            return 0;
        }
        
        // Get all members with the course role
        const membersWithCourseRole = courseRole.members;
        
        for (const [memberId, member] of membersWithCourseRole) {
            // Skip if already has the assignment role
            if (member.roles.cache.has(assignmentRole.id)) {
                continue;
            }
            
            try {
                await member.roles.add(assignmentRole, 'New assignment posted');
                assignedCount++;
            } catch (error) {
                console.error(`Failed to assign role to ${member.user.tag}:`, error.message);
            }
        }
        
        console.log(`Assigned "${assignmentRole.name}" to ${assignedCount} members`);
    } catch (error) {
        console.error('Error assigning roles:', error.message);
    }
    
    return assignedCount;
}

/**
 * Remove assignment role from a member (mark as done)
 * @param {GuildMember} member - Guild member
 * @param {Role} role - Role to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeAssignmentRole(member, role) {
    try {
        await member.roles.remove(role, 'Marked assignment as done');
        return true;
    } catch (error) {
        console.error(`Failed to remove role from ${member.user.tag}:`, error.message);
        return false;
    }
}

/**
 * Add assignment role to a member (mark as undone)
 * @param {GuildMember} member - Guild member
 * @param {Role} role - Role to add
 * @returns {Promise<boolean>} Success status
 */
export async function addAssignmentRole(member, role) {
    try {
        await member.roles.add(role, 'Marked assignment as not done');
        return true;
    } catch (error) {
        console.error(`Failed to add role to ${member.user.tag}:`, error.message);
        return false;
    }
}

/**
 * Delete an assignment role (cleanup after deadline)
 * @param {Guild} guild - Discord guild
 * @param {string} roleName - Role name to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteAssignmentRole(guild, roleName) {
    try {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
            await role.delete('Assignment deadline passed');
            console.log(`Deleted role: ${roleName}`);
            return true;
        }
    } catch (error) {
        console.error(`Failed to delete role "${roleName}":`, error.message);
    }
    return false;
}

/**
 * Find assignment role by assignment ID stored in data
 * @param {Guild} guild - Discord guild
 * @param {string} roleId - Role ID
 * @returns {Role|null} The role or null
 */
export function getAssignmentRoleById(guild, roleId) {
    return guild.roles.cache.get(roleId) || null;
}
