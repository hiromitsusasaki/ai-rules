const { ingestCommand } = require('./commands/ingest');
const { proposeCommand } = require('./commands/propose');
const { buildCommand } = require('./commands/build');
const { installCommand } = require('./commands/install');
const { initCommand } = require('./commands/init');
const { statusCommand } = require('./commands/status');
const { doctorCommand } = require('./commands/doctor');

function printHelp() {
  console.log(`ai-rules commands:
  ai-rules init [--source <path>]
  ai-rules ingest <url>
  ai-rules ingest --stdin
  ai-rules ingest --text "<text>"
  ai-rules ingest --file <path>
  ai-rules propose <inbox_path> | ai-rules propose --last
  ai-rules build
  ai-rules install
  ai-rules doctor
  ai-rules status`);
}

async function runCli(args) {
  const [command, ...rest] = args;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await initCommand(rest);
    return;
  }

  if (command === 'ingest') {
    await ingestCommand(rest);
    return;
  }

  if (command === 'status') {
    await statusCommand(rest);
    return;
  }

  if (command === 'doctor') {
    await doctorCommand(rest);
    return;
  }

  if (command === 'propose') {
    await proposeCommand(rest);
    return;
  }

  if (command === 'build') {
    await buildCommand(rest);
    return;
  }

  if (command === 'install') {
    await installCommand(rest);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

module.exports = { runCli };
