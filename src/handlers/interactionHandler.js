/**
 * Interaction Handler
 * Routes Discord interactions to appropriate command handlers
 * Handles button and select menu interactions
 */
import { handleAddReminder } from '../commands/addReminder.js';
import { handleDelReminder, delReminderAutocomplete } from '../commands/delReminder.js';
import { handlePingCommand } from '../commands/ping.js';
import { 
    handleAssignmentsCommand, 
    handleAssignmentsSelectMenu, 
    handleAssignmentsRefresh 
} from '../commands/assignments.js';
import { handleAssignmentButton, handleCourseRoleToggle } from './buttonHandler.js';
import log from '../utils/logger.js';

/**
 * Handle all incoming Discord interactions
 * @param {Interaction} interaction - Discord interaction
 */
export async function handleInteraction(interaction) {
    try {
        // Handle button interactions
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
            return;
        }
        
        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
            return;
        }
        
        // Handle autocomplete interactions
        if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
            return;
        }
        
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
            return;
        }
    } catch (error) {
        log.error('Error handling interaction', error);
        
        // Try to respond with an error message
        try {
            const errorResponse = {
                content: '❌ An unexpected error occurred. Please try again.',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        } catch (replyError) {
            log.error('Failed to send error response', replyError);
        }
    }
}

/**
 * Handle button interactions
 * @param {ButtonInteraction} interaction
 */
async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    // Assignment done/undone buttons
    if (customId.startsWith('assignment_done:') || customId.startsWith('assignment_undone:')) {
        await handleAssignmentButton(interaction);
        return;
    }
    
    // Assignments refresh button
    if (customId === 'assignments_refresh') {
        await handleAssignmentsRefresh(interaction);
        return;
    }
    
    // Course role toggle button
    if (customId.startsWith('course_role_toggle:')) {
        await handleCourseRoleToggle(interaction);
        return;
    }
    
    log.warn(`Unknown button interaction: ${customId}`);
    await interaction.reply({
        content: '❌ Unknown button.',
        ephemeral: true
    });
}

/**
 * Handle select menu interactions
 * @param {StringSelectMenuInteraction} interaction
 */
async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    
    // Assignments mark done/undone menus
    if (customId === 'assignments_mark_done' || customId === 'assignments_mark_undone') {
        await handleAssignmentsSelectMenu(interaction);
        return;
    }
    
    log.warn(`Unknown select menu interaction: ${customId}`);
    await interaction.reply({
        content: '❌ Unknown menu.',
        ephemeral: true
    });
}

/**
 * Handle autocomplete interactions
 * @param {AutocompleteInteraction} interaction
 */
async function handleAutocomplete(interaction) {
    const { commandName } = interaction;
    
    switch (commandName) {
        case 'delete-reminder':
            await delReminderAutocomplete(interaction);
            break;
        default:
            log.warn(`Unknown autocomplete command: ${commandName}`);
            await interaction.respond([]);
    }
}

/**
 * Handle slash command interactions
 * @param {CommandInteraction} interaction
 */
async function handleCommand(interaction) {
    const { commandName } = interaction;
    const userId = interaction.user.id;
    
    log.command(commandName, userId, interaction.options?.data);
    
    switch (commandName) {
        case 'assignments':
            await handleAssignmentsCommand(interaction);
            break;
        case 'ping':
            await handlePingCommand(interaction);
            break;
        case 'add-reminder':
            await handleAddReminder(interaction);
            break;
        case 'delete-reminder':
            await handleDelReminder(interaction);
            break;
        default:
            log.warn(`Unknown command: ${commandName}`);
            await interaction.reply({
                content: '❌ Unknown command.',
                ephemeral: true
            });
    }
}
