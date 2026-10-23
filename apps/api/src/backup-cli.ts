/**
 * The command line of the backup.
 *
 *   node dist/backup-cli.js             one backup now
 *   node dist/backup-cli.js --list      what is in the backup folder
 *   node dist/backup-cli.js --restore <file>   puts a backup back
 */

import { main } from "./backup.js";

main(process.argv.slice(2));
