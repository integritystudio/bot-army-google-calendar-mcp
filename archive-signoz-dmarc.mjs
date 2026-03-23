import { createGmailClient } from './lib/gmail-client.mjs';

async function archiveSignozAndDmarc() {
  const gmail = createGmailClient();

  console.log('📦 ARCHIVING SIGNOZ & DMARC EMAILS\n');
  console.log('═'.repeat(80) + '\n');

  let totalArchived = 0;

  try {
    // Archive SigNoz emails
    console.log('STEP 1: Archiving SigNoz alerts\n');

    const signozQuery = 'from:(alertmanager@signoz.cloud OR vishal@mail.signoz.io)';
    const signozResponse = await gmail.users.messages.list({
      userId: 'me',
      q: signozQuery,
      maxResults: 200
    });

    const signozIds = signozResponse.data.messages || [];
    console.log(`Found ${signozIds.length} SigNoz emails\n`);

    if (signozIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < signozIds.length; i += batchSize) {
        const batch = signozIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, signozIds.length);
        console.log(`  ✅ Archived ${processed}/${signozIds.length}`);
      }

      totalArchived += signozIds.length;
      console.log();
    }

    // Archive DMARC reports
    console.log('STEP 2: Archiving DMARC reports\n');

    const dmarcQuery = 'subject:DMARC';
    const dmarcResponse = await gmail.users.messages.list({
      userId: 'me',
      q: dmarcQuery,
      maxResults: 200
    });

    const dmarcIds = dmarcResponse.data.messages || [];
    console.log(`Found ${dmarcIds.length} DMARC emails\n`);

    if (dmarcIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < dmarcIds.length; i += batchSize) {
        const batch = dmarcIds.slice(i, i + batchSize);

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch.map(m => m.id),
            removeLabelIds: ['INBOX']
          }
        });

        const processed = Math.min(i + batchSize, dmarcIds.length);
        console.log(`  ✅ Archived ${processed}/${dmarcIds.length}`);
      }

      totalArchived += dmarcIds.length;
      console.log();
    }

    console.log('═'.repeat(80));
    console.log('COMPLETE\n');
    console.log(`✅ SigNoz alerts archived: ${signozIds.length}`);
    console.log(`✅ DMARC reports archived: ${dmarcIds.length}`);
    console.log(`📊 Total archived: ${totalArchived}\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

archiveSignozAndDmarc().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
