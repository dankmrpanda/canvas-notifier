/**
 * Assignments Command Handler
 * Shows users their pending assignments with options to mark them done/undone
 */
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { COURSES, COLORS } from '../../config.js';
import { loadCourseData } from '../utils/dataStore.js';

/**
 * Format a timestamp for Discord
 * @param {string} date - ISO date string
 * @param {string} format - Discord format
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(date, format = 'R') {
    if (!date) return 'N/A';
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    if (isNaN(timestamp)) return 'N/A';
    return `<t:${timestamp}:${format}>`;
}

/**
 * Get all assignments for a user across all courses
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<Array>} Array of assignments with status
 */
async function getUserAssignments(member) {
    const allAssignments = [];
    const now = new Date();
    
    for (const courseConfig of COURSES) {
        const data = await loadCourseData(courseConfig.courseId);
        
        if (!Array.isArray(data.assignments)) {
            continue;
        }
        
        for (const assignment of data.assignments) {
            if (assignment.deadline && new Date(assignment.deadline) <= now) {
                continue;
            }
            
            const hasRole = assignment.roleId && member.roles.cache.has(assignment.roleId);
            
            allAssignments.push({
                ...assignment,
                courseId: courseConfig.courseId,
                isDone: !hasRole,
                hasRole
            });
        }
    }
    
    allAssignments.sort((a, b) => {
        const dateA = a.deadline ? new Date(a.deadline) : new Date(9999, 11, 31);
        const dateB = b.deadline ? new Date(b.deadline) : new Date(9999, 11, 31);
        return dateA - dateB;
    });
    
    return allAssignments;
}

/**
 * Create the assignments list embed
 * @param {Array} assignments - Array of assignments
 * @returns {EmbedBuilder} Discord embed
 */
function createAssignmentsEmbed(assignments) {
    const embed = new EmbedBuilder()
        .setTitle('📚 Your Assignments')
        .setColor(COLORS.newAssignment)
        .setTimestamp();
    
    if (assignments.length === 0) {
        embed.setDescription('🎉 You have no pending assignments!');
        return embed;
    }
    
    const pending = assignments.filter(a => !a.isDone);
    const completed = assignments.filter(a => a.isDone);
    
    if (pending.length > 0) {
        const pendingList = pending.slice(0, 10).map((a, i) => {
            const deadline = formatTimestamp(a.deadline, 'R');
            const points = a.pointsPossible ? `(${a.pointsPossible} pts)` : '';
            const name = a.name.length > 40 ? a.name.substring(0, 37) + '...' : a.name;
            return `${i + 1}. **${name}** ${points}\n   └ Due: ${deadline}`;
        }).join('\n\n');
        
        embed.addFields({
            name: `⏳ Pending (${pending.length})`,
            value: pendingList || 'None',
            inline: false
        });
        
        if (pending.length > 10) {
            embed.addFields({
                name: '\u200b',
                value: `*...and ${pending.length - 10} more pending*`,
                inline: false
            });
        }
    }
    
    if (completed.length > 0) {
        embed.addFields({
            name: `✅ Completed (${completed.length})`,
            value: completed.slice(0, 5).map(a => {
                const name = a.name.length > 30 ? a.name.substring(0, 27) + '...' : a.name;
                return `~~${name}~~`;
            }).join(', ') + (completed.length > 5 ? ` +${completed.length - 5} more` : ''),
            inline: false
        });
    }
    
    embed.setFooter({ 
        text: `${pending.length} pending • ${completed.length} completed • Use the menus below to update status`
    });
    
    return embed;
}

/**
 * Create select menu for marking assignments as done
 * @param {Array} assignments - All assignments
 * @returns {ActionRowBuilder|null} Action row with select menu or null
 */
function createMarkDoneMenu(assignments) {
    const pending = assignments.filter(a => !a.isDone && a.roleId).slice(0, 25);
    
    if (pending.length === 0) {
        return null;
    }
    
    const options = pending.map(a => ({
        label: a.name.substring(0, 100),
        description: a.deadline ? `Due: ${new Date(a.deadline).toLocaleDateString()}` : 'No deadline',
        value: `${a.courseId}:${a.id}`
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('assignments_mark_done')
        .setPlaceholder('✅ Select assignments to mark as DONE')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options);
    
    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create select menu for marking assignments as not done
 * @param {Array} assignments - All assignments
 * @returns {ActionRowBuilder|null} Action row with select menu or null
 */
function createMarkUndoneMenu(assignments) {
    const completed = assignments.filter(a => a.isDone && a.roleId).slice(0, 25);
    
    if (completed.length === 0) {
        return null;
    }
    
    const options = completed.map(a => ({
        label: a.name.substring(0, 100),
        description: a.deadline ? `Due: ${new Date(a.deadline).toLocaleDateString()}` : 'No deadline',
        value: `${a.courseId}:${a.id}`
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('assignments_mark_undone')
        .setPlaceholder('🔄 Select assignments to mark as NOT DONE')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options);
    
    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create refresh button
 * @returns {ActionRowBuilder} Action row with refresh button
 */
function createRefreshButton() {
    const refreshButton = new ButtonBuilder()
        .setCustomId('assignments_refresh')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary);
    
    return new ActionRowBuilder().addComponents(refreshButton);
}

/**
 * Build components array for assignments view
 * @param {Array} assignments - All assignments
 * @returns {ActionRowBuilder[]} Array of action rows
 */
function buildComponents(assignments) {
    const components = [];
    
    const doneMenu = createMarkDoneMenu(assignments);
    if (doneMenu) {
        components.push(doneMenu);
    }
    
    const undoneMenu = createMarkUndoneMenu(assignments);
    if (undoneMenu) {
        components.push(undoneMenu);
    }
    
    components.push(createRefreshButton());
    
    return components;
}

/**
 * Handle the /assignments command
 * @param {CommandInteraction} interaction - Discord interaction
 */
export async function handleAssignmentsCommand(interaction) {
    const member = interaction.member;
    const guild = interaction.guild;
    
    if (!guild || !member) {
        return interaction.reply({
            content: '❌ This command only works in a server.',
            ephemeral: true
        });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const assignments = await getUserAssignments(member);
        const embed = createAssignmentsEmbed(assignments);
        const components = buildComponents(assignments);
        
        await interaction.editReply({
            embeds: [embed],
            components
        });
    } catch (error) {
        console.error('Error handling assignments command:', error);
        await interaction.editReply({
            content: '❌ Failed to load assignments. Please try again.'
        });
    }
}

/**
 * Handle select menu interactions for assignments
 * @param {StringSelectMenuInteraction} interaction - Discord select menu interaction
 */
export async function handleAssignmentsSelectMenu(interaction) {
    const customId = interaction.customId;
    const values = interaction.values;
    const member = interaction.member;
    const guild = interaction.guild;
    
    if (!guild || !member) {
        return interaction.reply({
            content: '❌ This only works in a server.',
            ephemeral: true
        });
    }
    
    await interaction.deferUpdate();
    
    const results = [];
    
    for (const value of values) {
        const [courseId, assignmentId] = value.split(':');
        const data = await loadCourseData(courseId);
        const assignment = data.assignments.find(a => String(a.id) === String(assignmentId));
        
        if (!assignment || !assignment.roleId) {
            results.push({ name: 'Unknown', success: false });
            continue;
        }
        
        const role = guild.roles.cache.get(assignment.roleId);
        if (!role) {
            results.push({ name: assignment.name, success: false });
            continue;
        }
        
        try {
            if (customId === 'assignments_mark_done') {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, 'Marked as done via /assignments');
                }
                results.push({ name: assignment.name, success: true, action: 'done' });
            } else if (customId === 'assignments_mark_undone') {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role, 'Marked as not done via /assignments');
                }
                results.push({ name: assignment.name, success: true, action: 'undone' });
            }
        } catch (error) {
            console.error(`Failed to update role for ${assignment.name}:`, error.message);
            results.push({ name: assignment.name, success: false });
        }
    }
    
    // Refresh the assignments list
    const assignments = await getUserAssignments(member);
    const embed = createAssignmentsEmbed(assignments);
    const components = buildComponents(assignments);
    
    // Add summary of changes
    const successful = results.filter(r => r.success);
    const summary = successful.length > 0
        ? `\n\n${successful.map(r => r.action === 'done' ? `✅ ${r.name}` : `🔄 ${r.name}`).join('\n')}`
        : '';
    
    await interaction.editReply({
        content: successful.length > 0 ? `Updated ${successful.length} assignment(s):${summary}` : null,
        embeds: [embed],
        components
    });
}

/**
 * Handle refresh button for assignments
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
export async function handleAssignmentsRefresh(interaction) {
    const member = interaction.member;
    const guild = interaction.guild;
    
    if (!guild || !member) {
        return interaction.reply({
            content: '❌ This only works in a server.',
            ephemeral: true
        });
    }
    
    await interaction.deferUpdate();
    
    try {
        const assignments = await getUserAssignments(member);
        const embed = createAssignmentsEmbed(assignments);
        const components = buildComponents(assignments);
        
        await interaction.editReply({
            content: null,
            embeds: [embed],
            components
        });
    } catch (error) {
        console.error('Error refreshing assignments:', error);
    }
}
