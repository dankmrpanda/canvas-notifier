# Canvas Notifier

A Discord bot that monitors Canvas LMS (Carnegie Mellon University) for assignments and sends notifications to your Discord server. Supports multiple courses with individual channel/role mappings. Features automatic reminders before deadlines and custom reminder support via slash commands.

## Features

- **New Assignment Notifications** - Get notified when assignments are posted
- **Assignment Updates** - Alerts when assignment deadlines change
- **Automatic Reminders** - Reminders at 24h, 6h, 3h, and 30min before deadlines
- **Done/Undone Buttons** - Mark assignments as complete to stop receiving reminders
- **Per-Assignment Roles** - Each assignment gets its own role for targeted pings
- **Assignment Dashboard** - View all your assignments with `/assignments` command
- **Custom Reminders** - Create personal reminders with `/add-reminder`
- **Reminder Management** - Delete reminders with `/delete-reminder`
- **Ping Toggle** - Enable/disable personal pings with `/ping`
- **Multi-Course Support** - Monitor multiple courses, each with its own Discord channel

## How Assignment Roles Work

When a new assignment is posted:
1. The bot creates a role named `Assignment Name`
2. All members with the course role automatically receive the assignment role
3. Reminders ping only the assignment role (not the course role)
4. Users can click **"Done"** to remove the role and stop receiving reminders
5. Users can click **"Not Done"** to re-add the role if needed
6. When the assignment deadline passes, the role is automatically deleted

## Requirements

- Node.js 18.x or higher
- Discord Bot Token
- Canvas API Token (from CMU Canvas)

### Discord Bot Permissions

The bot requires these permissions:
- **Manage Roles** - To create/delete assignment roles
- **Send Messages** - To post notifications
- **Embed Links** - For rich embeds

Enable these **Privileged Gateway Intents** in the Discord Developer Portal:
- **Server Members Intent** - Required to assign roles to course members

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

## Configuration

Edit `.env` with your credentials:

### Required Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `CLIENT_ID` | Discord application ID |
| `CANVAS_TOKEN` | Canvas API access token |

### Course Configuration

You can configure courses in two ways:

**Option 1: Multiple Courses (Recommended)**
```env
# Format: courseId:channelId:roleId,courseId:channelId:roleId,...
# roleId is optional

# Single course with role ping:
COURSES=12345:111111111111111111:222222222222222222

# Multiple courses:
COURSES=12345:111111111111111111:222222222222222222,67890:333333333333333333:444444444444444444
```

**Option 2: Single Course (Legacy)**
```env
COURSE_ID=12345
CHANNEL_ID=111111111111111111
ROLE_ID=222222222222222222
```

### Optional Variables

| Variable | Description |
|----------|-------------|
| `CANVAS_BASE_URL` | Canvas URL (defaults to `https://canvas.cmu.edu`) |

## Usage

### Local Development

Register slash commands (run once):
```bash
npm run register
```

Start the bot:
```bash
npm start
```

### Docker Deployment

Slash commands are automatically registered when the container starts.

```bash
# Build and start (commands auto-register)
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/assignments` | View your pending assignments and mark them done/undone |
| `/ping toggle:true/false` | Enable/disable personal notifications |
| `/add-reminder title:... reminder-date:MM-DD-YYYY reminder-time:HH:MM` | Create a custom reminder |
| `/delete-reminder reminder:...` | Delete a reminder (autocomplete) |

## Project Structure

```
├── config.js                    # Central configuration
├── index.js                     # Main entry point
├── Dockerfile                   # Docker image definition
├── docker-compose.yml           # Docker Compose config
├── src/
│   ├── commands/                # Slash command handlers
│   │   ├── addReminder.js
│   │   ├── assignments.js       # Assignment dashboard command
│   │   ├── delReminder.js
│   │   ├── ping.js
│   │   └── registerCommands.js
│   ├── handlers/
│   │   ├── buttonHandler.js     # Done/Undone button handling
│   │   └── interactionHandler.js
│   ├── services/
│   │   ├── assignmentService.js # Assignment checking (multi-course)
│   │   └── reminderService.js   # Reminder checking (multi-course)
│   └── utils/
│       ├── canvasApi.js         # Canvas API client
│       ├── dataStore.js         # JSON data management
│       ├── embedBuilder.js      # Discord embed creation
│       └── roleManager.js       # Assignment role management
└── courses/                     # Data storage (one file per course)
```

## Timing Configuration

Default intervals (configurable in `config.js`):
- Assignment checks: Every 10 minutes
- Reminder checks: Every 1 minute

## Reminder Thresholds

**Assignment Reminders:** 24 hours, 6 hours, 3 hours, 30 minutes before deadline

**Custom Reminders:** 1 week, 3 days, 1 day before, and at the scheduled time

## License

MIT
