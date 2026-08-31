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
  [/\bkarwai\b/gi, 'process / karwai'],
  [/\bwapsi\b/gi, 'withdrawal / wapsi'],
  [/\bshamil\b/gi, 'add / shamil']
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

async function fetchGTX(params) {
  const query = new URLSearchParams(params).toString();
  const url = `https://translate.googleapis.com/translate_a/single?${query}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`GTX translation HTTP error: ${response.status}`);
  }
  return response.json();
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
      // Try Hindi/Urdu latin script source
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
        console.warn('GTX sl=hi failed, trying auto:', err);
      }

      // If translation returned unchanged (often happens when words are recognized as English/Latin)
      // or if empty, try with sl=auto or sl=ur
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
      let rawRomanUrdu = '';

      try {
        const data = await fetchGTX({
          client: 'gtx',
          sl: 'auto',
          tl: 'ur',
          dt: 't',
          dt: 'rm',
          q: trimmed
        });

        if (data && Array.isArray(data[0])) {
          urduScript = data[0].map((x) => x[0]).filter(Boolean).join(' ').trim();
          
          // Google GTX provides Romanization in the array items
          for (const item of data[0]) {
            if (item && item[2] && typeof item[2] === 'string') {
              rawRomanUrdu = item[2];
            } else if (item && item[3] && typeof item[3] === 'string') {
              rawRomanUrdu = item[3];
            }
          }
        }

        // If transliteration wasn't directly found in data[0], check secondary fields
        if (!rawRomanUrdu && Array.isArray(data[1])) {
          for (const part of data[1]) {
            if (typeof part === 'string' && part.trim()) {
              rawRomanUrdu = part.trim();
              break;
            }
          }
        }
      } catch (err) {
        console.error('GTX English->Urdu error:', err);
      }

      const naturalRomanUrdu = cleanRomanUrdu(rawRomanUrdu || urduScript);

      const result = {
        success: true,
        direction: 'to_roman_urdu',
        original: trimmed,
        translation: naturalRomanUrdu,
        romanUrdu: naturalRomanUrdu,
        urdu: urduScript || naturalRomanUrdu
      };

      setCache(cacheKey, result);
      return NextResponse.json(result);
    }

    // Direction 3: Auto
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
