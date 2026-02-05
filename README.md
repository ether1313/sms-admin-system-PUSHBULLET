# SMS Admin System

Production-ready internal admin console for bulk SMS task management. This is a single internal system used only by SuperAdmin.

## Features

- **Task Management**: Create, view, and manage bulk SMS tasks
- **Contact Management**: Bulk import contacts via textarea input
- **Scheduled Execution**: Schedule tasks for automatic execution
- **Manual Trigger**: Manually trigger draft tasks
- **Execution Engine**: Background worker processes tasks automatically
- **Pushbullet Integration**: Sends SMS via Pushbullet NOTE pushes
- **Execution Logging**: Detailed logs for each contact execution
- **Authentication**: Simple username/password authentication for SuperAdmin

## Tech Stack

- **Backend**: Node.js + TypeScript
- **Framework**: Express
- **Database**: PostgreSQL + Prisma ORM
- **UI**: Server-rendered HTML with Tailwind CSS
- **Architecture**: Monolith (single codebase, single server)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Pushbullet API token

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd sms-admin-system
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb sms_admin
```

Or using psql:

```sql
CREATE DATABASE sms_admin;
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Random secret for session encryption
- `PUSHBULLET_API_TOKEN`: Your Pushbullet API token
- `PUSHBULLET_DEVICE_IDEN`: Device iden of the phone that sends SMS (from Pushbullet devices API)
- `SMS_DELAY_MS`: Delay between SMS sends (default: 1000ms)
- `PORT`: Server port (default: 3000)

### 4. Database Migration

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Seed 10 sender machines (optional but recommended)

Create 10 placeholder sender machines (SIM 1–SIM 10). Then fill each machine’s `apiToken` and `deviceIden` in Prisma Studio:

```bash
npx prisma db seed
npx prisma studio
```

In Prisma Studio, open the **SenderMachine** table and set each row’s `apiToken` and `deviceIden` (Pushbullet API token and device iden for that phone). Creating a task lets you select one or more machines; contacts are split across them.

### 6. Create SuperAdmin Account

Create the initial SuperAdmin account:

```bash
npx tsx src/scripts/createAdmin.ts
```

Enter a username and password when prompted.

### 7. Start the Server

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## Usage

### Accessing the Admin Console

1. Navigate to `http://localhost:3000`
2. Login with your SuperAdmin credentials
3. You'll be redirected to the tasks list

### Creating a Task

1. Click "Create Task"
2. Fill in:
   - **Task Name**: Descriptive name for the task
   - **Message Template**: SMS message with optional `{name}` placeholder
   - **Scheduled At** (optional): When to automatically execute
   - **Contacts**: One per line, format:
     - `+61412345678` (phone only)
     - `+61412345678 John Doe` (phone + name)
3. Click "Create Task"

### Task Statuses

- **draft**: Created but not executed (requires manual trigger)
- **scheduled**: Will execute automatically at `scheduledAt` time
- **running**: Currently executing
- **completed**: All contacts processed successfully
- **failed**: Some contacts failed (check logs)

### Manual Execution

Tasks in `draft` or `scheduled` status can be manually triggered from the task detail page.

### Contact Phone Format

The system accepts various Australian phone formats and normalizes them to E.164 format (+61...):

- `+61412345678` → `+61412345678`
- `61412345678` → `+61412345678`
- `0412345678` → `+61412345678`
- `412345678` → `+61412345678`

Invalid numbers are rejected during task creation.

### Message Template

Use `{name}` in your message template to insert the contact's name. If a contact doesn't have a name, `{name}` will be replaced with an empty string.

Example:
```
Hello {name}, your appointment is confirmed.
```

For contact "John Doe": `Hello John Doe, your appointment is confirmed.`
For contact without name: `Hello , your appointment is confirmed.`

### Pushbullet Integration

The system sends SMS via Pushbullet’s **SMS Texting** API (`/v2/texts`). Messages appear in Pushbullet’s “SMS Texting” and are sent from your linked phone.

**Required environment variables:**

- `PUSHBULLET_API_TOKEN` – Your Pushbullet access token (Account Settings)
- `PUSHBULLET_DEVICE_IDEN` – The device iden of the phone that will send SMS (from `GET https://api.pushbullet.com/v2/devices` with your token; use the `iden` of your phone)

Your phone must be powered on, connected to the internet, and have Pushbullet installed with SMS permissions. Pushbullet Pro may be required for more than 100 messages per month.

### Execution Engine

The execution engine:

- Automatically resumes interrupted tasks on server start
- Polls for scheduled tasks every 30 seconds
- Processes contacts sequentially with configurable delay
- Retries failed sends up to 3 times with exponential backoff
- Updates task and contact status in real-time

### Viewing Execution Logs

Navigate to a task's detail page to see:

- Overall execution statistics (total, success, failed, pending)
- Per-contact execution status
- Error messages for failed sends
- Sent timestamps

## Development

### Project Structure

```
sms-admin-system/
├── src/
│   ├── server.ts              # Main server entry point
│   ├── routes/                # Express routes
│   │   ├── auth.ts           # Authentication routes
│   │   └── tasks.ts          # Task management routes
│   ├── middleware/           # Express middleware
│   │   └── auth.ts           # Authentication middleware
│   ├── services/             # Business logic
│   │   └── executionEngine.ts # Task execution engine
│   ├── utils/                # Utility functions
│   │   └── contacts.ts       # Contact parsing/normalization
│   ├── views/                # Server-rendered views
│   │   ├── layout.ts         # Layout templates
│   │   └── tasks.ts          # Task views
│   └── scripts/              # Utility scripts
│       └── createAdmin.ts    # Admin creation script
├── prisma/
│   └── schema.prisma         # Database schema
├── .env.example              # Environment variables template
└── README.md                 # This file
```

### Database Management

View/edit data with Prisma Studio:

```bash
npm run prisma:studio
```

Create a new migration after schema changes:

```bash
npm run prisma:migrate
```

## Security Notes

- Change `SESSION_SECRET` in production
- Use HTTPS in production
- Keep your Pushbullet API token secure
- This is an internal-only system (no public access)

## Troubleshooting

### Database Connection Issues

Ensure PostgreSQL is running and `DATABASE_URL` is correct:

```bash
psql $DATABASE_URL
```

### Pushbullet API Errors

- Verify your API token is correct
- Check Pushbullet API status
- Review error messages in task execution logs

### Tasks Not Executing

- Check server logs for errors
- Verify task status is `running` or `scheduled`
- Ensure `PUSHBULLET_API_TOKEN` and `PUSHBULLET_DEVICE_IDEN` are set
- Check execution engine logs in console

## License

ISC
