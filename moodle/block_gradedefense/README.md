# Grade Defense Moodle Block

A Moodle 4.5+ block plugin that embeds the Grade Defense game and automatically syncs upcoming calendar events (assignments, quizzes, exams) from your Moodle courses.

## Features

- Embeds the Grade Defense game as an iframe in your Dashboard or course pages
- Automatically collects upcoming action events (assignments, quizzes, exams) for the next 70 days
- Sends event data to the game via secure postMessage communication
- Server-side data collection (no client-side API calls, no security concerns)
- Responsive design with 16:9 aspect ratio
- Works on Dashboard (My Moodle) and course view pages

## Requirements

- Moodle 4.5 or higher (requires Moodle version 2024100700)
- PHP 7.4 or higher

## Installation

### Method 1: Web Interface

1. Download the `block_gradedefense` folder
2. Create a zip archive of the entire `block_gradedefense` folder
3. Log in to your Moodle site as administrator
4. Navigate to **Site administration → Plugins → Install plugins**
5. Upload the zip file
6. Click "Install plugin from the ZIP file"
7. Follow the on-screen instructions to complete installation

### Method 2: Manual Installation

1. Download the `block_gradedefense` folder
2. Copy it to your Moodle installation's `blocks/` directory:
   ```bash
   cp -r block_gradedefense /path/to/moodle/blocks/
   ```
3. Log in to your Moodle site as administrator
4. Navigate to **Site administration → Notifications**
5. Follow the on-screen instructions to complete installation

### Method 3: Command Line

```bash
cd /path/to/moodle/blocks/
cp -r /path/to/block_gradedefense ./
sudo -u www-data php admin/cli/upgrade.php
```

## Configuration

After installation, you can configure the game URL:

1. Navigate to **Site administration → Plugins → Blocks → Grade Defense**
2. Set the **Game URL** field to your deployed game URL
   - Default: `https://aywinu.github.io/GradeDefense/`
   - Must end with a trailing slash
3. Click "Save changes"

## Usage

### Adding the Block to Dashboard

1. Navigate to your Dashboard (My Moodle)
2. Click "Customize this page" or "Turn editing on"
3. Find "Grade Defense" in the "Add a block" menu
4. Click to add the block
5. The game will load with your upcoming events automatically synced

### Adding the Block to a Course

1. Navigate to a course page
2. Turn editing on
3. Find "Grade Defense" in the "Add a block" menu
4. Click to add the block
5. The game will load with events from all your courses

## Data Collected

The block collects the following data from your Moodle calendar events:

- Event ID (internal Moodle ID)
- Course short name (e.g., "CS101")
- Course full name (e.g., "Introduction to Computer Science")
- Event name (e.g., "Assignment 1")
- Due date (ISO 8601 format)
- Event type (assignment, quiz, exam, project, presentation)
- Points/grade maximum (if available from grade book)

**Security Note:** The block does NOT collect or transmit:
- User passwords or session tokens
- Email addresses
- Student IDs or personal identifiable information
- Grade data (only the maximum possible grade for weighting)

## Technical Details

### postMessage Communication

The block uses the HTML5 postMessage API for secure cross-origin communication:

1. The game iframe loads and sends a ready signal:
   ```javascript
   { type: 'gradedefense:ready' }
   ```

2. The block responds with semester data:
   ```javascript
   {
     type: 'gradedefense:semester',
     version: 1,
     events: [
       {
         id: 123,
         courseId: "CS101",
         courseTitle: "Introduction to Computer Science",
         name: "Assignment 1",
         dueDate: "2026-12-03T23:59:00+00:00",
         type: "assignment",
         points: 100
       },
       // ... more events
     ]
   }
   ```

3. Origin validation ensures messages are only sent to the configured game URL

See [`docs/moodle-integration.md`](../../docs/moodle-integration.md) for complete API documentation.

## Troubleshooting

### Block doesn't appear after installation

- Clear Moodle cache: **Site administration → Development → Purge all caches**
- Verify file permissions (block files should be readable by web server)

### Game doesn't load

- Check that the Game URL setting is correct and ends with a trailing slash
- Verify the game URL is accessible from your network
- Check browser console for CORS or iframe errors

### Events not syncing

- Verify calendar events exist in Moodle (check Dashboard → Calendar)
- Check browser console for postMessage errors
- Ensure the game origin matches the configured Game URL
- Try reloading the page

### PHP syntax errors

The block follows Moodle coding guidelines. If you encounter syntax errors:

1. Verify PHP version is 7.4 or higher
2. Check Moodle error logs at `moodledata/` or **Site administration → Reports → Logs**
3. Ensure all required Moodle libraries are available

## Uninstallation

1. Navigate to **Site administration → Plugins → Plugins overview**
2. Find "Grade Defense" in the Blocks section
3. Click "Uninstall"
4. Confirm the uninstallation
5. Optionally, manually delete the `blocks/block_gradedefense/` directory

## License

This plugin is licensed under the GNU GPL v3 or later, consistent with Moodle's license.

## Support

For issues, feature requests, or contributions, please visit the main Grade Defense repository.

## Credits

Developed for the Kiroween 2026 Hackathon as part of the Grade Defense project.
