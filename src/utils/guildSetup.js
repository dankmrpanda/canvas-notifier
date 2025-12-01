/**
 * Guild Setup Utility
 * Handles automatic creation of roles, categories, and channels
 * based on Canvas course data
 */
import { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchCoursesWithAssignments } from './canvasApi.js';
import log from './logger.js';

/**
 * Delay helper for rate limiting
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sanitize a string for use as a Discord channel name
 * Discord channel names: lowercase, no spaces (use hyphens), max 100 chars
 * @param {string} name - The name to sanitize
 * @returns {string} Sanitized channel name
 */
function sanitizeChannelName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
}

/**
 * Sanitize a string for use as a Discord role name
 * @param {string} name - The name to sanitize
 * @returns {string} Sanitized role name (max 100 chars)
 */
function sanitizeRoleName(name) {
    return name.substring(0, 100);
}

/**
 * Get or create a category by name
 * @param {Guild} guild - Discord guild
 * @param {string} categoryName - Name for the category
 * @returns {Promise<CategoryChannel|null>} The category channel or null
 */
async function getOrCreateCategory(guild, categoryName) {
    const sanitizedName = categoryName.substring(0, 100);
    
    let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && 
             c.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    
    if (category) {
        log.debug(`Found existing category: ${category.name}`);
        return category;
    }
    
    try {
        await delay(500);
        category = await guild.channels.create({
            name: sanitizedName,
            type: ChannelType.GuildCategory,
            reason: `Auto-created for Canvas term: ${categoryName}`
        });
        
        log.discord('categoryCreate', `Created category: ${category.name}`, { categoryId: category.id });
        return category;
    } catch (error) {
        if (error.code === 50013) {
            log.error(`Missing permissions to create category "${categoryName}"`);
        } else if (error.code === 30013) {
            log.error(`Maximum number of categories reached`);
        } else {
            log.error(`Failed to create category "${categoryName}"`, error);
        }
        return null;
    }
}

/**
 * Get or create a role by name
 * @param {Guild} guild - Discord guild
 * @param {string} roleName - Name for the role
 * @param {number} color - Role color (hex)
 * @returns {Promise<Role|null>} The role or null
 */
async function getOrCreateRole(guild, roleName, color = 0x3498db) {
    const sanitizedName = sanitizeRoleName(roleName);
    
    let role = guild.roles.cache.find(
        r => r.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    
    if (role) {
        log.debug(`Found existing role: ${role.name}`);
        return role;
    }
    
    try {
        await delay(500);
        role = await guild.roles.create({
            name: sanitizedName,
            color: color,
            mentionable: true,
            reason: `Auto-created for Canvas course: ${roleName}`
        });
        
        log.discord('roleCreate', `Created role: ${role.name}`, { roleId: role.id });
        return role;
    } catch (error) {
        if (error.code === 50013) {
            log.error(`Missing permissions to create role "${roleName}"`);
        } else if (error.code === 30005) {
            log.error(`Maximum number of roles reached`);
        } else {
            log.error(`Failed to create role "${roleName}"`, error);
        }
        return null;
    }
}


/**
 * Get or create a text channel under a category (RESTRICTED to course role only)
 * @param {Guild} guild - Discord guild
 * @param {string} channelName - Name for the channel
 * @param {CategoryChannel} category - Parent category
 * @param {Role} courseRole - Role that should have access
 * @returns {Promise<TextChannel|null>} The text channel or null
 */
async function getOrCreateChannel(guild, channelName, category, courseRole) {
    const sanitizedName = sanitizeChannelName(channelName);
    
    // Check if channel already exists in this category
    let channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && 
             c.name.toLowerCase() === sanitizedName.toLowerCase() &&
             c.parentId === category?.id
    );
    
    if (channel) {
        log.debug(`Found existing channel: ${channel.name}`);
        return channel;
    }
    
    // Also check without category constraint
    channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && 
             c.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    
    if (channel) {
        log.debug(`Found existing channel (different category): ${channel.name}`);
        return channel;
    }
    
    try {
        await delay(500);
        
        const channelOptions = {
            name: sanitizedName,
            type: ChannelType.GuildText,
            reason: `Auto-created for Canvas course assignments`
        };
        
        if (category) {
            channelOptions.parent = category.id;
        }
        
        // RESTRICTED: Only course role members can see this channel
        const permissionOverwrites = [
            {
                id: guild.id, // @everyone - CANNOT view
                deny: [PermissionFlagsBits.ViewChannel]
            }
        ];
        
        // Bot needs access
        if (guild.members.me?.id) {
            permissionOverwrites.push({
                id: guild.members.me.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
            });
        }
        
        // Course role can view and send
        if (courseRole) {
            permissionOverwrites.push({
                id: courseRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }
        
        channelOptions.permissionOverwrites = permissionOverwrites;
        
        channel = await guild.channels.create(channelOptions);
        
        log.discord('channelCreate', `Created restricted channel: ${channel.name}${category ? ` under ${category.name}` : ''}`, { channelId: channel.id });
        return channel;
    } catch (error) {
        if (error.code === 50013) {
            log.error(`Missing permissions to create channel "${channelName}"`);
        } else if (error.code === 30013) {
            log.error(`Maximum number of channels reached`);
        } else {
            log.error(`Failed to create channel "${channelName}"`, error);
        }
        return null;
    }
}

/**
 * Create a role selection embed for a course
 * @param {Object} courseConfig - Course configuration
 * @returns {{embed: EmbedBuilder, button: ActionRowBuilder}} Embed and button
 */
function createRoleSelectionEmbed(courseConfig) {
    const embed = new EmbedBuilder()
        .setTitle(`📚 ${courseConfig.courseCode}`)
        .setDescription(`**${courseConfig.courseName}**\n\nClick the button below to join or leave this course.\n\n• When you join, you'll get access to the course channel and receive assignment notifications.\n• When you leave, you'll lose access and stop receiving notifications.`)
        .setColor(0x3498db)
        .setFooter({ text: 'Click to toggle your enrollment' });
    
    const button = new ButtonBuilder()
        .setCustomId(`course_role_toggle:${courseConfig.courseId}:${courseConfig.roleId}`)
        .setLabel('Toggle Course Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎓');
    
    const row = new ActionRowBuilder().addComponents(button);
    
    return { embed, components: [row] };
}

/**
 * Get or create the roles channel for a category
 * @param {Guild} guild - Discord guild
 * @param {CategoryChannel} category - Parent category
 * @returns {Promise<TextChannel|null>} The roles channel or null
 */
async function getOrCreateRolesChannel(guild, category) {
    const channelName = 'roles';
    
    // Check if roles channel already exists in this category
    let channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && 
             c.name === channelName &&
             c.parentId === category?.id
    );
    
    if (channel) {
        log.debug(`Found existing roles channel in ${category.name}`);
        return channel;
    }
    
    try {
        await delay(500);
        
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category?.id,
            topic: 'Click the buttons below to join or leave courses',
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone can view but not send
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                },
                {
                    id: guild.members.me?.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
                }
            ].filter(p => p.id),
            reason: `Auto-created for course role selection`
        });
        
        log.discord('channelCreate', `Created roles channel in ${category.name}`, { channelId: channel.id });
        return channel;
    } catch (error) {
        log.error(`Failed to create roles channel in ${category?.name}`, error);
        return null;
    }
}

/**
 * Send or update role selection embeds in a roles channel
 * @param {TextChannel} rolesChannel - The roles channel
 * @param {Array} coursesInTerm - Courses in this term
 */
async function setupRoleSelectionEmbeds(rolesChannel, coursesInTerm) {
    try {
        // Delete existing messages from the bot
        const messages = await rolesChannel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.id === rolesChannel.guild.members.me?.id);
        
        for (const [, msg] of botMessages) {
            try {
                await msg.delete();
                await delay(300);
            } catch (e) {
                // Ignore deletion errors
            }
        }
        
        // Send header
        await rolesChannel.send({
            content: '# 🎓 Course Role Selection\nClick the buttons below to join or leave courses. You\'ll get access to course channels and assignment notifications.'
        });
        
        await delay(500);
        
        // Send embed for each course
        for (const course of coursesInTerm) {
            if (!course.roleId) continue;
            
            const { embed, components } = createRoleSelectionEmbed(course);
            await rolesChannel.send({ embeds: [embed], components });
            await delay(500);
        }
        
        log.info(`Set up role selection embeds in ${rolesChannel.name} for ${coursesInTerm.length} courses`);
    } catch (error) {
        log.error(`Failed to setup role selection embeds`, error);
    }
}


/**
 * Set up guild structure based on Canvas courses
 * Creates categories (by term), roles (by course code), channels (by course code),
 * and role selection channels
 * 
 * @param {Guild} guild - Discord guild
 * @returns {Promise<Array>} Array of course configurations with Discord IDs
 */
export async function setupGuildFromCanvas(guild) {
    log.info('Fetching courses from Canvas...');
    
    const courses = await fetchCoursesWithAssignments();
    
    if (courses.length === 0) {
        log.info('No courses with assignments found');
        return [];
    }
    
    log.info(`Found ${courses.length} courses with assignments`);
    
    const courseConfigs = [];
    const categoryCache = new Map(); // termName -> category
    const termCourses = new Map(); // termName -> courses[]
    
    // First pass: create categories, roles, and channels
    for (const course of courses) {
        log.info(`Setting up course: ${course.courseName} (${course.courseCode})`);
        
        // Get or create category for this term
        let category = categoryCache.get(course.termName);
        if (!category) {
            category = await getOrCreateCategory(guild, course.termName);
            if (category) {
                categoryCache.set(course.termName, category);
            }
        }
        
        // Create role based on course code
        const role = await getOrCreateRole(guild, course.courseCode, 0x3498db);
        
        // Create RESTRICTED channel (only course role can see)
        const channel = await getOrCreateChannel(guild, course.courseCode, category, role);
        
        if (channel) {
            const config = {
                courseId: String(course.courseId),
                channelId: channel.id,
                roleId: role?.id || null,
                courseName: course.courseName,
                courseCode: course.courseCode,
                termName: course.termName,
                categoryId: category?.id || null
            };
            
            courseConfigs.push(config);
            
            // Track courses by term for role selection setup
            if (!termCourses.has(course.termName)) {
                termCourses.set(course.termName, []);
            }
            termCourses.get(course.termName).push(config);
        }
    }
    
    // Second pass: create role selection channels for each term
    for (const [termName, coursesInTerm] of termCourses) {
        const category = categoryCache.get(termName);
        if (!category) continue;
        
        const rolesChannel = await getOrCreateRolesChannel(guild, category);
        if (rolesChannel) {
            await setupRoleSelectionEmbeds(rolesChannel, coursesInTerm);
        }
    }
    
    log.info(`Guild setup complete. Configured ${courseConfigs.length} courses.`);
    
    return courseConfigs;
}

/**
 * Verify and repair guild setup
 * @param {Guild} guild - Discord guild
 * @param {Array} courseConfigs - Existing course configurations
 * @returns {Promise<Array>} Updated course configurations
 */
export async function verifyGuildSetup(guild, courseConfigs) {
    const updatedConfigs = [];
    
    for (const config of courseConfigs) {
        let needsUpdate = false;
        const updatedConfig = { ...config };
        
        const channel = guild.channels.cache.get(config.channelId);
        if (!channel) {
            log.warn(`Channel missing for course ${config.courseCode}, will recreate`);
            needsUpdate = true;
        }
        
        if (config.roleId) {
            const role = guild.roles.cache.get(config.roleId);
            if (!role) {
                log.warn(`Role missing for course ${config.courseCode}, will recreate`);
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            let category = null;
            if (config.categoryId) {
                category = guild.channels.cache.get(config.categoryId);
            }
            if (!category && config.termName) {
                category = await getOrCreateCategory(guild, config.termName);
                updatedConfig.categoryId = category?.id || null;
            }
            
            if (!guild.roles.cache.get(config.roleId)) {
                const role = await getOrCreateRole(guild, config.courseCode);
                updatedConfig.roleId = role?.id || null;
            }
            
            if (!guild.channels.cache.get(config.channelId)) {
                const role = guild.roles.cache.get(updatedConfig.roleId);
                const newChannel = await getOrCreateChannel(guild, config.courseCode, category, role);
                updatedConfig.channelId = newChannel?.id || config.channelId;
            }
        }
        
        updatedConfigs.push(updatedConfig);
    }
    
    return updatedConfigs;
}

/**
 * Sync assignment roles when a course role is added/removed
 * @param {GuildMember} member - The guild member
 * @param {string} courseRoleId - The course role ID
 * @param {boolean} added - Whether the role was added (true) or removed (false)
 * @param {Array} assignments - Assignments for this course
 */
export async function syncAssignmentRoles(member, courseRoleId, added, assignments) {
    const guild = member.guild;
    
    for (const assignment of assignments) {
        if (!assignment.roleId) continue;
        
        const assignmentRole = guild.roles.cache.get(assignment.roleId);
        if (!assignmentRole) continue;
        
        try {
            if (added) {
                // Add assignment role if member doesn't have it
                if (!member.roles.cache.has(assignmentRole.id)) {
                    await member.roles.add(assignmentRole, 'Course role added - syncing assignment roles');
                    log.info(`Added assignment role "${assignmentRole.name}" to ${member.user.tag}`);
                }
            } else {
                // Remove assignment role if member has it
                if (member.roles.cache.has(assignmentRole.id)) {
                    await member.roles.remove(assignmentRole, 'Course role removed - syncing assignment roles');
                    log.info(`Removed assignment role "${assignmentRole.name}" from ${member.user.tag}`);
                }
            }
            await delay(300); // Rate limit protection
        } catch (error) {
            log.error(`Failed to sync assignment role for ${member.user.tag}`, error);
        }
    }
}

export { getOrCreateCategory, getOrCreateRole, getOrCreateChannel, sanitizeChannelName, createRoleSelectionEmbed };
