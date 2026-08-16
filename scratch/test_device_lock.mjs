// Simulate browser environment for deviceId test
global.window = {};
global.document = {
  cookie: '',
  createElement: () => ({
    getContext: () => ({
      textBaseline: 'top',
      font: '',
      fillStyle: '',
      fillRect: () => {},
      fillText: () => {},
      getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 1, UNMASKED_RENDERER_WEBGL: 2 }),
      getParameter: () => 'NVIDIA GeForce Mock'
    }),
    toDataURL: () => 'data:image/png;base64,mockcanvas'
  })
};

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; }
};
const sessionStore = {};
global.sessionStorage = {
  getItem: (k) => sessionStore[k] || null,
  setItem: (k, v) => { sessionStore[k] = v; },
  removeItem: (k) => { delete sessionStore[k]; }
};

global.screen = { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 2 };

const { getOrCreateDeviceId, getDeviceFingerprint, getDevicePayload } = await import('../src/lib/deviceId.js');

console.log('Testing deviceId.js helper with browser simulation...');
const payload = getDevicePayload();
console.log('Generated Payload:', payload);

if (payload && payload.deviceId && payload.deviceId.startsWith('did_') && payload.deviceFingerprint && payload.deviceFingerprint.startsWith('fp_')) {
  console.log('✅ TEST PASSED: getDevicePayload() generated valid persistent deviceId and hardware fingerprint!');
  
  // Test persistence
  const secondCall = getDevicePayload();
  if (secondCall.deviceId === payload.deviceId && secondCall.deviceFingerprint === payload.deviceFingerprint) {
    console.log('✅ TEST PASSED: Second call preserved identical deviceId and deviceFingerprint!');
  } else {
    console.error('❌ Persistence test failed', { payload, secondCall });
    process.exit(1);
  }
} else {
  console.error('❌ TEST FAILED:', payload);
  process.exit(1);
}
