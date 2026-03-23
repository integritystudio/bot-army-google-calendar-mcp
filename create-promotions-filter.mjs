import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(process.env.HOME, '.config/google-calendar-mcp/tokens-gmail.json');

async function createPromotionsFilter() {
  const tokenFileData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const accountMode = process.env.ACCOUNT_MODE || 'normal';
  const tokenData = tokenFileData[accountMode];

  const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './credentials.json';
  const credData = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const oauth2Client = new OAuth2Client(
    credData.installed.client_id,
    credData.installed.client_secret,
    credData.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(tokenData);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log('🎯 CREATING PROMOTIONS FILTER\n');
  console.log('═'.repeat(80) + '\n');

  try {
    const promotionsLabelId = 'CATEGORY_PROMOTIONS';

    console.log(`📌 Using Promotions label: ${promotionsLabelId}\n`);

    // Create filter for promotional emails
    const criteria = {
      subject: 'sale OR discount OR promo OR promotional OR offer OR deal OR save OR limited time OR free shipping OR coupon OR special offer',
      from: 'marketing@ OR promotions@ OR deals@ OR noreply+promo@ OR newsletter@',
    };

    const response = await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria,
        action: {
          addLabelIds: [promotionsLabelId],
        },
      },
    });

    console.log('✅ FILTER CREATED SUCCESSFULLY\n');
    console.log('Filter Details:');
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Label Applied: Promotions (${promotionsLabelId})`);
    console.log('\nFilter Criteria:');
    console.log(`  Subject contains: sale, discount, promo, promotional, offer, deal, save, limited time, free shipping, coupon, special offer`);
    console.log(`  From contains: marketing@, promotions@, deals@, noreply+promo@, newsletter@`);
    console.log('\n💡 Future promotional emails matching this filter will automatically be labeled.');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createPromotionsFilter();
