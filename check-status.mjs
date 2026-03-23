import { execSync } from 'child_process';
import { chdir } from 'process';

try {
  chdir('/Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp');

  console.log('=== Recent commits ===');
  console.log(execSync('git log --oneline -5', { encoding: 'utf-8' }));

  console.log('\n=== Current branch ===');
  console.log(execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }));

  console.log('\n=== Files in commit ===');
  console.log(execSync('git diff --name-only HEAD~1 HEAD | grep "create-.*-filter"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).split('\n').filter(Boolean).join('\n'));
} catch (error) {
  console.error('Error:', error.message);
}
