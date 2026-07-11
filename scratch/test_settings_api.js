async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/settings/frontend');
    const data = await res.json();
    console.log('GET STATUS:', res.status);
    console.log('GET DATA SUCCESS:', data.success);
    console.log('SETTINGS KEYS:', data.settings ? Object.keys(data.settings) : 'none');
    if (data.settings) {
      console.log('notificationSoundUrl length:', data.settings.notificationSoundUrl ? data.settings.notificationSoundUrl.length : 0);
      console.log('notificationSoundUrl preview:', data.settings.notificationSoundUrl ? data.settings.notificationSoundUrl.substring(0, 100) : 'none');
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
