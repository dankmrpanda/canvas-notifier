/*
node commands/slashCmd.js
updates slash cmd
*/
import { DISCORD_TOKEN, CLIENT_ID} from '../../config.js';

import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes, ApplicationCommandOptionType } from 'discord.js';

const commands = [
  {
    name: 'ping',
    description: 'enable/disable pings for you (default false)',
    options: [
      {
        name: 'toggle', //ima kms name and description cant be the same what
        description: 'toggles',
        type: ApplicationCommandOptionType.Boolean,
        required: true,
      },
    ],
  },
  {
    name: 'add-reminder',
    description: 'adds a reminder',
    options: [
      {
        name: 'title', 
        description: 'add title',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'reminder-date',
        description: 'Specify the reminder date (e.g., MM-DD-YYYY)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'reminder-time',
        description: 'Specify the reminder time (e.g., HH:MM or HH:MM AM/PM)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'description', 
        description: 'add description',
        type: ApplicationCommandOptionType.String,
        required: false,
      },

    ],
  },
  {
    name: 'delete-reminder',
    description: 'Deletes a reminder from your list',
    options: [
      {
        name: 'reminder',
        description: 'Select the reminder to delete',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true, // Enable autocomplete to provide a list of reminders
      },
    ],
  },
];


const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      { body: commands }
    );
    console.log('Slash commands were registered successfully!');
  } catch (error) {
    console.log(`There was an error: ${error}`);
  }
})();