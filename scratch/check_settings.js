const { getDb } = require('../src/lib/mongodb');

async function main() {
  try {
    const db = await getDb();
    const settingsCollection = db.collection('settings');
    const doc = await settingsCollection.findOne({ id: 'frontend_settings' });
    if (!doc) {
      console.log('No settings document found!');
    } else {
      console.log('Settings document found.');
      console.log('ID:', doc.id);
      console.log('notificationSoundUrl exists:', !!doc.notificationSoundUrl);
      if (doc.notificationSoundUrl) {
        console.log('notificationSoundUrl prefix:', doc.notificationSoundUrl.substring(0, 100));
        console.log('notificationSoundUrl total length:', doc.notificationSoundUrl.length);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
