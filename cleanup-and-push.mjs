import { execSync } from 'child_process';
import { chdir } from 'process';
import { unlinkSync } from 'fs';

try {
  chdir('/Users/alyshialedlie/code/is-internal/bot-army-google-calendar-mcp');

  try {
    unlinkSync('commit-unit4.mjs');
  } catch (e) {
    // Already removed
  }

  try {
    execSync('git rm --cached commit-unit4.mjs 2>/dev/null', { stdio: 'pipe' });
    execSync('git commit --amend --no-edit 2>/dev/null', { stdio: 'pipe' });
  } catch (e) {
    // No changes to amend
  }

  try {
    execSync('git checkout -b unit4-filter-refactor', { stdio: 'inherit' });
  } catch (e) {
    execSync('git checkout unit4-filter-refactor', { stdio: 'inherit' });
  }

  execSync('git push -u origin unit4-filter-refactor', { stdio: 'inherit' });

  const prBody = 'Unit 4 refactoring: Replace inline me literals with USER_ID constant in all create-*-filter.mjs scripts';
  const prResult = execSync(`gh pr create --title "refactor(scripts): use USER_ID constant in filter scripts" --body "${prBody}"`, { encoding: 'utf-8' });

  console.log(prResult);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
