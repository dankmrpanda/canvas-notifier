# Canvas Notifier

Canvas Notifier is a Discord bot that monitors a Canvas course and posts updates to your Discord server. It can announce new assignments, send reminders before due dates and lets users create custom reminders through slash commands.

## Features

- Notify a channel when a new assignment is posted.
- Send reminders as deadlines approach (1 day, 6 hours, 3 hours and 30 minutes beforehand).
- Slash commands to add or delete custom reminders.
- Assignment and reminder data stored locally in `courses/<COURSE_ID>.json`.

## Setup

1. Ensure Node.js 16 or newer is installed.
2. Install dependencies (a `package.json` is not included by default):
   ```bash
   npm init -y
   npm install discord.js dotenv node-fetch string-strip-html
   ```
3. Create a `.env` file in the project root with the following variables:
   ```
   DISCORD_TOKEN=<discord bot token>
   CANVAS_TOKEN=<canvas api token>
   COURSE_ID=<canvas course id>
   CHANNEL_ID=<discord channel id for posting updates>
   ROLE_ID=<role id to mention>
   CLIENT_ID=<discord application id>   # required for slash command registration
   ```

## Running

Start the bot with:
```bash
node index.js
```

Register (or refresh) slash commands with:
```bash
node src/commands/slashCmd.js
```

The bot creates a JSON file inside `courses/` named after your `COURSE_ID` to persist assignments and reminders.
