import { NextResponse } from 'next/server';

// In-memory translation cache to make repeat translations instant
const translationCache = new Map();
const MAX_CACHE_SIZE = 600;

function setCache(key, value) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

// Preprocessing dictionary for common Pakistani Roman Urdu words, slang, and chat abbreviations
const ROMAN_URDU_EXPANSIONS = [
  [/\byr\b/gi, 'yaar'],
  [/\bkb\b/gi, 'kab'],
  [/\btk\b/gi, 'tak'],
  [/\baey\s*ga\b/gi, 'aayega'],
  [/\baaye\s*ga\b/gi, 'aayega'],
  [/\baye\s*ga\b/gi, 'aayega'],
  [/\baey\s*gi\b/gi, 'aayegi'],
  [/\bkr\s*do\b/gi, 'kar do'],
  [/\bkr\s*dein\b/gi, 'kar dijiye'],
  [/\bkr\s*dia\b/gi, 'kar diya'],
  [/\bkr\s*diya\b/gi, 'kar diya'],
  [/\bkr\s*deta\s*hu\b/gi, 'kar deta hoon'],
  [/\bkr\s*deta\s*hn\b/gi, 'kar deta hoon'],
  [/\bkr\s*raha\s*hu\b/gi, 'kar raha hoon'],
  [/\bkr\s*raha\s*hn\b/gi, 'kar raha hoon'],
  [/\bkr\s*k\b/gi, 'kar ke'],
  [/\bkr\s*ke\b/gi, 'kar ke'],
  [/\bkr\b/gi, 'kar'],
  [/\bpy\b/gi, 'par'],
  [/\bpe\b/gi, 'par'],
  [/\bma\b/gi, 'mein'],
  [/\bme\b/gi, 'mein'],
  [/\bhn\b/gi, 'hoon'],
  [/\bdein\b/gi, 'dijiye'],
  [/\bden\b/gi, 'dijiye'],
  [/\bnai\b/gi, 'nahi'],
  [/\bni\b/gi, 'nahi'],
  [/\bnh\b/gi, 'nahi'],
  [/\bkro\b/gi, 'karo'],
  [/\bplz\b/gi, 'please'],
  [/\bpls\b/gi, 'please'],
  [/\bwapis\b/gi, 'wapas'],
  [/\bacc\b/gi, 'account'],
  [/\bmsg\b/gi, 'message'],
  [/\bpic\b/gi, 'picture'],
  [/\bss\b/gi, 'screenshot'],
  [/\bupr\b/gi, 'upar'],
  [/\bneeche\b/gi, 'niche'],
  [/\bkn\b/gi, 'kaun'],
  [/\bkch\b/gi, 'kuch'],
  [/\bbs\b/gi, 'bas'],
  [/\bjb\b/gi, 'jab'],
  [/\btb\b/gi, 'tab'],
  [/\bab\b/gi, 'ab'],
  [/\bkoi\b/gi, 'koi'],
  [/\bkesy\b/gi, 'kaise'],
  [/\bkaesy\b/gi, 'kaise'],
  [/\bkaisy\b/gi, 'kaise']
];

function preprocessRomanUrdu(text) {
  if (!text) return '';
  let s = ' ' + text.trim() + ' ';
  for (const [p, r] of ROMAN_URDU_EXPANSIONS) {
    s = s.replace(p, r);
  }
  return s.trim();
}

// Full Urdu script letter-to-Roman transliteration mapping
const URDU_TO_ROMAN_LETTERS = {
  'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
  'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
  'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
  'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e', 'ئ': 'i',
  'ة': 't', 'ؤ': 'o', ' ': ' '
};

// High-frequency dictionary mapping for natural Pakistani Roman Urdu words
const COMMON_URDU_WORDS = {
  'میں': 'mein', 'نے': 'ne', 'ابھی': 'abhi', 'ایک': 'ek', 'اور': 'aur',
  'رقم': 'rakam', 'جمع': 'deposit / jama', 'کرائی': 'karayi', 'ہے': 'hai',
  'ہیں': 'hain', 'تھا': 'tha', 'تھی': 'thi', 'تھے': 'thay', 'کیا': 'kya',
  'کیوں': 'kyun', 'کب': 'kab', 'کہاں': 'kahan', 'کیسے': 'kaise', 'آپ': 'aap',
  'تم': 'tum', 'ہم': 'hum', 'وہ': 'woh', 'یہ': 'ye', 'کا': 'ka', 'کی': 'ki',
  'کے': 'ke', 'کو': 'ko', 'سے': 'se', 'پر': 'par', 'تک': 'tak', 'نہیں': 'nahi',
  'شکریہ': 'shukriya', 'واپسی': 'withdrawal', 'اکاؤنٹ': 'account',
  'گیم': 'game', 'بیلنس': 'balance', 'پیسے': 'paise', 'منظور': 'approved',
  'بھیج': 'bhej', 'دیں': 'dein', 'کرو': 'karo', 'کریں': 'karein', 'ہو': 'ho',
  'گیا': 'gaya', 'گئی': 'gayi', 'گئے': 'gaye', 'چاہتا': 'chahta', 'چاہتی': 'chahti',
  'جاننا': 'jaanna', 'بتائیں': 'batayein', 'دیکھیں': 'dekhein', 'مسئلہ': 'issue',
  'سپورٹ': 'support', 'لنک': 'link', 'ڈاؤنلوڈ': 'download', 'پاسورڈ': 'password',
  'ڈپازٹ': 'deposit', 'صرف': 'sirf', 'لوگوں': 'logon', 'بتانا': 'batana', 'کہ': 'ke',
  'بس': 'bas', 'چیک': 'check', 'معلومات': 'info'
};

function transliterateUrduToRoman(urduText) {
  if (!urduText) return '';
  const words = urduText.split(/\s+/);
  const romanWords = words.map((w) => {
    const clean = w.replace(/[،۔؟!.,?!]/g, '').trim();
    if (!clean) return '';
    if (COMMON_URDU_WORDS[clean]) {
      return COMMON_URDU_WORDS[clean];
    }
    let res = '';
    for (const char of clean) {
      res += URDU_TO_ROMAN_LETTERS[char] || char;
    }
    return res;
  }).filter(Boolean);
  return romanWords.join(' ');
}

// Converts raw transliterations to natural Pakistani Roman Urdu
const ROMAN_URDU_REFINEMENTS = [
  [/\blican\b/gi, 'lekin'],
  [/\bmin\b/gi, 'mein'],
  [/\bhay\b/gi, 'hai'],
  [/\bhen\b/gi, 'hain'],
  [/\bnihen\b/gi, 'nahi'],
  [/\bkiya\b/gi, 'kya'],
  [/\bmajhe\b/gi, 'mujhe'],
  [/\batna\b/gi, 'itna'],
  [/\bwaqat\b/gi, 'waqt'],
  [/\bkiyon\b/gi, 'kyun'],
  [/\bhogya\b/gi, 'ho gaya'],
  [/\bhoga\b/gi, 'hoga'],
  [/\bdoun lod\b/gi, 'download'],
  [/\bgim\b/gi, 'game'],
  [/\bacount\b/gi, 'account'],
  [/\blank\b/gi, 'link'],
  [/\bsake\b/gi, 'coins'],
  [/\bkarwai\b/gi, 'karwai'],
  [/\bwapsi\b/gi, 'withdrawal / wapsi'],
  [/\bshamil\b/gi, 'add / shamil'],
  [/\brakham\b/gi, 'rakam'],
  [/\bshkaria\b/gi, 'shukriya'],
  [/\bbas aap logon ko batana chahta tha kah\b/gi, 'aap ko batana chahta tha ke']
];

function cleanRomanUrdu(raw) {
  if (!raw) return '';
  let text = raw.trim();
  for (const [p, r] of ROMAN_URDU_REFINEMENTS) {
    text = text.replace(p, r);
  }
  return text;
}

// Formats English output cleanly
function cleanEnglish(raw) {
  if (!raw) return '';
  let text = raw.trim();
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text;
}

// Engine 1: Google GTX Endpoint
async function fetchGTX(params) {
  const query = new URLSearchParams(params).toString();
  const url = `https://translate.googleapis.com/translate_a/single?${query}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`GTX translation HTTP error: ${response.status}`);
  }
  return response.json();
}

// Engine 2: Google Chrome Client Endpoint (Highly reliable on cloud hosting)
async function fetchDictChrome(text, sl, tl) {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Chrome Client HTTP error: ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data.join(' ').trim();
  }
  if (typeof data === 'string') {
    return data.trim();
  }
  return '';
}

// Engine 3: MyMemory Translation API
async function fetchMyMemory(text, langpair = 'en|ur') {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`MyMemory HTTP error: ${response.status}`);
  }
  const data = await response.json();
  return data?.responseData?.translatedText || '';
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, direction = 'to_english' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const trimmed = text.trim();
    const cacheKey = `${direction}:${trimmed}`;
    if (translationCache.has(cacheKey)) {
      return NextResponse.json(translationCache.get(cacheKey));
    }

    // Direction 1: Roman Urdu -> English (Admin to User)
    if (direction === 'to_english') {
      const preprocessed = preprocessRomanUrdu(trimmed);

      let englishTranslation = '';

      // Try Engine 1: GTX sl=hi
      try {
        const dataHi = await fetchGTX({
          client: 'gtx',
          sl: 'hi',
          tl: 'en',
          dt: 't',
          q: preprocessed
        });
        if (dataHi && Array.isArray(dataHi[0])) {
          englishTranslation = dataHi[0].map((x) => x[0]).filter(Boolean).join(' ').trim();
        }
      } catch (err) {
        console.warn('GTX sl=hi failed, trying fallback:', err);
      }

      // If translation returned unchanged or failed, try Engine 1 sl=auto
      if (!englishTranslation || englishTranslation.toLowerCase() === preprocessed.toLowerCase() || englishTranslation.toLowerCase() === trimmed.toLowerCase()) {
        try {
          const dataAuto = await fetchGTX({
            client: 'gtx',
            sl: 'auto',
            tl: 'en',
            dt: 't',
            q: preprocessed
          });
          if (dataAuto && Array.isArray(dataAuto[0])) {
            const autoEn = dataAuto[0].map((x) => x[0]).filter(Boolean).join(' ').trim();
            if (autoEn) englishTranslation = autoEn;
          }
        } catch (err) {
          console.warn('GTX sl=auto failed:', err);
        }
      }

      // If still unchanged, try Engine 2 (dict-chrome-ex)
      if (!englishTranslation || englishTranslation.toLowerCase() === preprocessed.toLowerCase() || englishTranslation.toLowerCase() === trimmed.toLowerCase()) {
        try {
          const chromeEn = await fetchDictChrome(preprocessed, 'auto', 'en');
          if (chromeEn) englishTranslation = chromeEn;
        } catch (err) {
          console.warn('Dict-chrome failed:', err);
        }
      }

      englishTranslation = cleanEnglish(englishTranslation || trimmed);

      const result = {
        success: true,
        direction: 'to_english',
        original: trimmed,
        translation: englishTranslation,
        english: englishTranslation
      };

      setCache(cacheKey, result);
      return NextResponse.json(result);
    }

    // Direction 2: English / Any -> Roman Urdu & Urdu Script (User to Admin)
    if (direction === 'to_roman_urdu') {
      let urduScript = '';
      let rawUrduRoman = '';
      let rawHindiRoman = '';

      // Parallel fetch from multiple endpoints for both Urdu script + Latin transliterations
      try {
        const [resUr, resHi] = await Promise.all([
          fetchGTX({
            client: 'gtx',
            sl: 'auto',
            tl: 'ur',
            dt: 't',
            dt: 'rm',
            q: trimmed
          }).catch(() => null),
          fetchGTX({
            client: 'gtx',
            sl: 'auto',
            tl: 'hi',
            dt: 't',
            dt: 'rm',
            q: trimmed
          }).catch(() => null)
        ]);

        if (resUr && Array.isArray(resUr[0])) {
          urduScript = resUr[0].map((x) => x[0]).filter(Boolean).join(' ').trim();
          for (const item of resUr[0]) {
            if (item && item[2] && typeof item[2] === 'string' && item[2].trim()) {
              rawUrduRoman = item[2].trim();
            } else if (item && item[3] && typeof item[3] === 'string' && item[3].trim()) {
              rawUrduRoman = item[3].trim();
            }
          }
        }

        if (resHi && Array.isArray(resHi[0])) {
          for (const item of resHi[0]) {
            if (item && item[2] && typeof item[2] === 'string' && item[2].trim()) {
              rawHindiRoman = item[2].trim();
            } else if (item && item[3] && typeof item[3] === 'string' && item[3].trim()) {
              rawHindiRoman = item[3].trim();
            }
          }
        }
      } catch (err) {
        console.warn('GTX translation error:', err);
      }

      // Fallback 1: If urduScript is missing, try dict-chrome-ex
      if (!urduScript) {
        try {
          urduScript = await fetchDictChrome(trimmed, 'en', 'ur');
        } catch (err) {
          console.warn('Dict-chrome Urdu fallback failed:', err);
        }
      }

      // Fallback 2: If still missing, try MyMemory
      if (!urduScript) {
        try {
          urduScript = await fetchMyMemory(trimmed, 'en|ur');
        } catch (err) {
          console.warn('MyMemory Urdu fallback failed:', err);
        }
      }

      // Build Roman Urdu string
      let romanResult = '';

      // Check if rawUrduRoman is Latin alphabet
      if (rawUrduRoman && !/[\u0600-\u06FF]/.test(rawUrduRoman)) {
        romanResult = cleanRomanUrdu(rawUrduRoman);
      } else if (rawHindiRoman && !/[\u0600-\u06FF]/.test(rawHindiRoman)) {
        romanResult = cleanRomanUrdu(rawHindiRoman);
      } else if (urduScript) {
        romanResult = cleanRomanUrdu(transliterateUrduToRoman(urduScript));
      }

      // Double-check: If romanResult is identical to the English input or empty, transliterate from Urdu
      if (!romanResult || romanResult.toLowerCase() === trimmed.toLowerCase()) {
        if (urduScript) {
          romanResult = cleanRomanUrdu(transliterateUrduToRoman(urduScript));
        }
      }

      // Final fallback if translation completely failed
      if (!romanResult) {
        romanResult = cleanRomanUrdu(transliterateUrduToRoman(urduScript || trimmed));
      }

      const result = {
        success: true,
        direction: 'to_roman_urdu',
        original: trimmed,
        translation: romanResult || urduScript,
        romanUrdu: romanResult || urduScript,
        urdu: urduScript || ''
      };

      setCache(cacheKey, result);
      return NextResponse.json(result);
    }

    return NextResponse.json({
      success: false,
      message: 'Unknown direction. Use "to_english" or "to_roman_urdu".'
    }, { status: 400 });

  } catch (error) {
    console.error('Translation route error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Internal translation error.'
    }, { status: 500 });
  }
}
