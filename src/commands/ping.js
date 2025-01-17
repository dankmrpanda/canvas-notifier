import fs from 'fs/promises';
import { dataFilePath } from '../../config.js';
import { loadPing } from '../utils/pingToggle.js';

export async function handlePingCommand(interaction) {
    const toggle = interaction.options.get('toggle').value;
    try {
        let data = await loadPing();

        // Check the toggle value
        if (toggle) {
        // Add user to the list if not already present
        if (!data.user.includes(interaction.user.id)) {
            data.user.push(interaction.user.id);
            await interaction.reply({ content: 'Pings enabled for you!', flags: 64 }); // 64 is for ephemeral messages
        } else {
            await interaction.reply({ content: 'Pings are already enabled for you!', flags: 64 });
        }
        } else {
        // Remove user from the list if present
        if (data.user.includes(interaction.user.id)) {
            data.user = data.user.filter((id) => id !== interaction.user.id);
            await interaction.reply({ content: 'Pings disabled for you!', flags: 64 });
        } else {
            await interaction.reply({ content: 'Pings are already disabled for you!', flags: 64 });
        }
        }

        // Write the updated JSON back to the file
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving assignments file:', error);
        await interaction.reply({ content: 'An error occurred while updating your preferences.', flags: 64 });
    }
}