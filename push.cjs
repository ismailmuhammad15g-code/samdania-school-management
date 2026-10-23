
const { spawnSync } = require('child_process');
const readline = require('readline');

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function say(color, message) {
  console.log(color + message + c.reset);
}

function git(args, live = false) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: live ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function output(args) {
  const result = git(args);

  if (result.status !== 0) {
    throw new Error(
      (result.stderr || 'Git command failed').trim()
    );
  }

  return (result.stdout || '').trim();
}

function runGit(args) {
  return git(args, true).status === 0;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('');
  say(c.magenta, '==========================================');
  say(c.cyan, '       AUTO GIT PUSH - WINDOWS');
  say(c.magenta, '==========================================');

  // Check repository
  try {
    output(['rev-parse', '--is-inside-work-tree']);
  } catch {
    say(c.red, 'ERROR: This folder is not a Git repository.');
    process.exitCode = 1;
    return;
  }

  // Detect current branch
  let branch;

  try {
    branch = output(['branch', '--show-current']);
  } catch (error) {
    say(c.red, error.message);
    process.exitCode = 1;
    return;
  }

  if (!branch) {
    say(c.red, 'ERROR: Please switch to a named Git branch.');
    process.exitCode = 1;
    return;
  }

  // Check pending changes
  let status;

  try {
    status = output(['status', '--porcelain']);
  } catch (error) {
    say(c.red, error.message);
    process.exitCode = 1;
    return;
  }

  if (status) {
    say(c.cyan, 'New changes detected:');
    console.log(status);

    say(c.cyan, 'Adding files...');
    if (!runGit(['add', '-A'])) {
      say(c.red, 'ERROR: git add failed.');
      process.exitCode = 1;
      return;
    }

    say(c.green, 'Files added successfully.');

    const message = await ask(
      'Enter commit message: '
    );

    const commitMessage = message ||
      `Project update ${new Date().toISOString()}`;

    say(c.cyan, 'Creating commit...');

    if (!runGit(['commit', '-m', commitMessage])) {
      say(c.red, 'ERROR: Commit failed. Check the output above.');
      process.exitCode = 1;
      return;
    }

    say(c.green, 'Commit created successfully.');
  } else {
    say(c.yellow, 'No new changes. Checking pending commits...');
  }

  // Check if an upstream branch already exists
  const upstream = git([
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}'
  ]);

  say(c.cyan, 'Pushing to GitHub...');

  let pushed;

  if (upstream.status === 0) {
    pushed = runGit(['push']);
  } else {
    // First push: configure upstream automatically
    pushed = runGit([
      'push',
      '--set-upstream',
      'origin',
      branch
    ]);
  }

  if (!pushed) {
    say(c.red, 'PUSH FAILED.');
    say(
      c.yellow,
      'Read the Git error above. Check remote URL, login, ' +
      'network, or remote changes.'
    );
    process.exitCode = 1;
    return;
  }

  say(c.green, 'SUCCESS! Project pushed to GitHub.');
  say(c.magenta, '==========================================');
}

main().catch(error => {
  say(c.red, 'ERROR: ' + error.message);
  process.exitCode = 1;
});
