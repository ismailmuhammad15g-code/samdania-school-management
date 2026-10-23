#!/usr/bin/env node
/**
 * Auto Push Script
 * يقوم تلقائياً بعمل git add + commit + push
 * كل ما تحتاجه هو كتابة رسالة الـ commit فقط
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// ألوان للطباعة في التيرمنال
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function line() {
  console.log(c.gray + '─'.repeat(46) + c.reset);
}

function title(text) {
  console.log(`\n${c.magenta}${c.bold}✦ ${text}${c.reset}`);
}

function step(text) {
  console.log(`${c.cyan}➤ ${text}${c.reset}`);
}

function success(text) {
  console.log(`${c.green}✔ ${text}${c.reset}`);
}

function fail(text) {
  console.log(`${c.red}✘ ${text}${c.reset}`);
}

function run(cmd) {
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function runLive(cmd) {
  const res = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  return res.status === 0;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.clear();
  line();
  console.log(`${c.bold}${c.cyan}   🚀  Auto Git Push${c.reset}`);
  line();

  // 1) التأكد أننا داخل مستودع Git
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch (e) {
    fail('هذا المجلد ليس مستودع Git (git repository).');
    process.exit(1);
  }

  // 2) معرفة اسم الفرع الحالي
  let branch = 'main';
  try {
    branch = run('git rev-parse --abbrev-ref HEAD');
  } catch (e) {}

  // 3) التحقق من وجود تغييرات
  let status = '';
  try {
    status = run('git status --porcelain');
  } catch (e) {
    fail('تعذر قراءة حالة المشروع.');
    process.exit(1);
  }

  if (!status) {
    success('لا توجد أي تغييرات جديدة، المشروع محدث بالفعل ✨');
    process.exit(0);
  }

  step('تم رصد تغييرات جديدة في المشروع:');
  console.log(c.gray + status + c.reset);

  // 4) git add -A
  step('جاري إضافة الملفات (git add)...');
  if (!runLive('git add -A')) {
    fail('فشل في إضافة الملفات.');
    process.exit(1);
  }
  success('تمت إضافة الملفات بنجاح.');

  // 5) طلب رسالة الـ commit
  console.log('');
  const msg = await ask(`${c.yellow}✎ اكتب رسالة الـ commit ثم اضغط Enter:${c.reset} `);
  const commitMessage = msg || `تحديث المشروع - ${new Date().toLocaleString('ar-EG')}`;

  // 6) git commit
  step('جاري عمل commit...');
  const commitRes = spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
  if (commitRes.status !== 0) {
    fail('فشل في عملية الـ commit.');
    process.exit(1);
  }
  success(`تم الـ commit برسالة: "${commitMessage}"`);

  // 7) git push
  step(`جاري الرفع (push) إلى الفرع "${branch}"...`);
  if (!runLive('git push')) {
    fail('فشل الرفع. تحقق من اتصالك بالإنترنت أو صلاحيات الفرع.');
    process.exit(1);
  }

  line();
  success('تم رفع المشروع بنجاح إلى GitHub 🎉');
  line();
}

main();
