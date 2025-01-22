/*
npm init -y
npm install discord.js dotenv node-fetch string-strip-html
node index.js
*/
import { Client, GatewayIntentBits } from 'discord.js';

// import { handlePingCommand } from './src/commands/ping.js';
import { handleAddReminder } from './src/commands/addReminder.js';
import { delReminderAutocomplete,  handleDelReminder} from './src/commands/delReminder.js';
import { DISCORD_TOKEN } from './config.js';

import { ensureJsonFile } from './src/utils/jsonHandling.js';
import { checkForReminders } from './src/utils/assignmentReminders.js';
import { checkForNewAssignments } from './src/utils/assignments.js';
import { remindercheck } from './src/utils/reminders.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await ensureJsonFile();

  // Run both checks immediately
  try {
    await checkForNewAssignments(client);
    console.log('Initial assignment check completed.');
    await checkForReminders(client);
    console.log('Initial reminder check completed.');
  } catch (error) {
    console.error('Error during initial checks:', error);
  }

  // Variable to track the last check time for assignments
  let lastAssignmentCheckTime = Date.now();

  // Schedule checks to run every 10 minutes
  setInterval(async () => {
    const currentTime = Date.now();
    const timeSinceLastCheck = (currentTime - lastAssignmentCheckTime) / 1000; // Time in seconds

    try {
      console.log(`Time since last assignment check: ${timeSinceLastCheck.toFixed(2)} seconds`);
      await checkForNewAssignments(client);
      console.log('Assignment check completed.');
      lastAssignmentCheckTime = currentTime; // Update the last check time
    } catch (error) {
      console.error('Error during assignment check:', error);
    }
  }, 10 * 60 * 1000); // Every 5 seconds (update the interval as needed)

  remindercheck(client).catch(err =>
    console.error('Uncaught error in reminder check loop:', err)
  );
});

client.on('interactionCreate', async (interaction) => {
  // if (interaction.commandName === 'ping') {
  //   handlePingCommand(interaction);
  // }

  if (interaction.commandName === 'add-reminder') {
    handleAddReminder(interaction);
  }

  if (interaction.isAutocomplete() && interaction.commandName === 'delete-reminder') {
    delReminderAutocomplete(interaction);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'delete-reminder') {
    handleDelReminder(interaction);
  }
});

client.login(DISCORD_TOKEN);