import { createGmailClient } from './lib/gmail-client.mjs';

const USER_ID = 'me';

async function createPromotionsFilter() {
  const gmail = createGmailClient();

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
      userId: USER_ID,
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
