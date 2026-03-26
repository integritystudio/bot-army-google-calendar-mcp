const BANNER_WIDTH = 80;
const BANNER_CHAR = '═';
const DIVIDER_CHAR = '─';

export const BANNER = BANNER_CHAR.repeat(BANNER_WIDTH);
export const DIVIDER = DIVIDER_CHAR.repeat(BANNER_WIDTH);

export function printBanner(title) {
  console.log(BANNER);
  if (title) console.log(`\n${title}\n`);
}

export function printComplete(summary) {
  console.log(BANNER);
  console.log('COMPLETE\n');
  if (summary) console.log(summary);
  console.log(BANNER + '\n');
}
