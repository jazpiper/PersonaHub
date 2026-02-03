# PersonaHub 시큐어 코딩 리뷰 보고서

**리뷰 날짜:** 2026년 2월 3일
**프로젝트:** PersonaHub (다중 성격 분석 허브)
**기술스택:** Express.js, HTML5, CSS, JavaScript (Vanilla), localStorage, Vercel 배포

---

## 🔒 보안 점수: 4/10

---

## 📋 요약

PersonaHub 프로젝트는 **중간 수준의 보안 위험**을 가지고 있습니다. 클라이언트 사이드 애플리케이션이고 개인정보를 수집하지 않지만, 기본적인 웹 보안 표준(CSP, 보안 헤더 등)이 부족합니다. XSS 공격과 광고 관련 보안 문제가 주요 우려 사항입니다.

---

## 🚨 심각 (Critical) 취약점

### 1. XSS (Cross-Site Scripting) 취약성

**위험도:** 🔴 높음

**위치:**
- `public/index.html` - 라인 180-200 (최근 분석 렌더링)
- `public/assessments/mbti.html` - 라인 120-150 (결과 표시)
- `public/common.js` - 라인 135-138 (createElement 함수)

**문제:**
```javascript
// index.html - 사용자 입력 검증 없는 innerHTML 사용
recentAssessmentsList.innerHTML = sortedResults.map(([assessmentId, result]) => `
  <div class="recent-assessment-item">
    <div class="recent-assessment-name">${assessmentNames[assessmentId] || assessmentId}</div>
    <div class="recent-assessment-result">${result.resultType}</div>
  </div>
`).join('');

// common.js - innerHTML에 의존
createElement: (tag, className, content = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.innerHTML = content;  // ⚠️ 위험
  return element;
}
```

**위험 시나리오:**
- localStorage에 저장된 데이터가 악의적으로 수정될 경우 XSS 발생
- JSON 데이터 파일이 변조되면 스크립트 실행 가능

**해결 방안:**
```javascript
// 1. innerHTML 대신 textContent 또는 DOM API 사용
const element = document.createElement('div');
element.textContent = assessmentNames[assessmentId] || assessmentId;

// 2. DOMPurify 라이브러리 사용하여 HTML sanitization
// npm install dompurify
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);

// 3. localStorage 데이터 읽을 때 검증
function sanitizeResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    ...result,
    resultType: sanitizeText(result.resultType)
  };
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

### 2. Content Security Policy (CSP) 부재

**위험도:** 🔴 높음

**문제:**
- Express 서버에 CSP 헤더가 설정되지 않음
- 인라인 스크립트가 사용됨 (AdSense)
- `eval()` 또는 유사한 동적 코드 실행 방지 없음

**위험 시나리오:**
- XSS 공격 시 실행 가능한 공격면 증가
- 광고 스크립트에서 악의적 코드 실행 가능

**해결 방안:**
```javascript
// server.js에 helmet 미들웨어 추가
const helmet = require('helmet');
const csp = require('helmet-csp');

// CSP 설정
app.use(csp({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://pagead2.googlesyndication.com',
      'https://www.google-analytics.com'
    ],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    frameSrc: ["'self'", 'https://tpc.googlesyndication.com'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    reportUri: '/csp-violation-report'  // CSP 위반 리포팅
  },
  reportOnly: false
}));

// 또는 helmet 기본 설정 사용
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://pagead2.googlesyndication.com"],
    },
  },
}));
```

---

## ⚠️ 높음 (High) 취약점

### 3. localStorage 보안 이슈

**위험도:** 🟠 중간-높음

**위치:** `public/common.js` - 라인 28-42

**문제:**
```javascript
storage: {
  set: (key, value) => {
    localStorage.setItem(`personaHub_${key}`, JSON.stringify(value));
  },
  get: (key) => {
    const item = localStorage.getItem(`personaHub_${key}`);
    return item ? JSON.parse(item) : null;  // ⚠️ JSON 파싱 시 에러 처리 없음
  }
}
```

**위험 시나리오:**
- 모든 데이터가 평문으로 저장됨 (암호화 없음)
- 같은 origin의 모든 스크립트가 접근 가능
- JSON.parse 실패 시 앱이 중단될 수 있음
- 사용자 데이터 만료/삭제 메커니즘 없음

**해결 방안:**
```javascript
// 1. JSON 파싱 에러 처리
storage: {
  set: (key, value) => {
    try {
      const data = JSON.stringify({
        value: value,
        timestamp: Date.now(),
        version: 1
      });
      localStorage.setItem(`personaHub_${key}`, data);
    } catch (e) {
      console.error('localStorage 저장 실패:', e);
    }
  },
  get: (key) => {
    try {
      const item = localStorage.getItem(`personaHub_${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);
      
      // 데이터 만료 체크 (30일)
      const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > MAX_AGE) {
        this.remove(key);
        return null;
      }

      return parsed.value;
    } catch (e) {
      console.error('localStorage 읽기 실패:', e);
      return null;
    }
  },
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('personaHub_'))
        .forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error('localStorage 삭제 실패:', e);
    }
  }
}

// 2. 민감 데이터 저장 피하기
// 결과 데이터만 저장하고 개인 식별 정보는 저장하지 않음
```

---

### 4. AdSense 보안 문제

**위험도:** 🟠 중간-높음

**위치:** `public/index.html`, `public/assessments/*.html`

**문제:**
```html
<!-- 다수의 AdSense 스크립트가 페이지에 포함 -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4896634202351610" crossorigin="anonymous"></script>
```

**위험 시나리오:**
- Malvertising (악의적 광고) 가능성
- SameSite 쿠키 없는 경우 추적 우려
- 광고 스크립트가 페이지 성능 저하

**해결 방안:**
```html
<!-- 1. AdSense 스크립트를 페이지 하단에 배치 (deferred loading) -->
<script async defer src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" 
        client="ca-pub-4896634202351610" 
        crossorigin="use-credentials"></script>

<!-- 2. 광고 컨테이너를 sandboxed iframe으로 격리 -->
<iframe sandbox="allow-scripts allow-same-origin allow-popups"
        src="ad-frame.html"
        title="Advertisement"></iframe>

<!-- 3. AdSense 로드 실패 시 fallback 처리 -->
<script>
window.addEventListener('error', function(e) {
  if (e.target.tagName === 'SCRIPT' && e.target.src.includes('googlesyndication')) {
    console.warn('AdSense 로드 실패');
    // 광고 컨테이너 숨기기
    document.querySelectorAll('.ad-container').forEach(el => el.style.display = 'none');
  }
}, true);
</script>

<!-- 4. 광고 수를 최소화 (현재 2개 -> 1개로 줄이기 권장) -->
```

---

### 5. HTTP 보안 헤더 부재

**위험도:** 🟠 중간

**위치:** `server.js`

**문제:**
기본적인 보안 헤더가 전혀 설정되지 않음

**해결 방안:**
```javascript
// server.js에 helmet 미들웨어 추가
const helmet = require('helmet');

app.use(helmet({
  // X-Content-Type-Options: nosniff
  contentSecurityPolicy: false,  // 직접 CSP 설정 시 false로
  
  // X-Frame-Options: DENY (클릭재킹 방지)
  frameguard: { action: 'deny' },
  
  // X-XSS-Protection: 1; mode=block
  xssFilter: true,
  
  // Referrer-Policy: strict-origin-when-cross-origin
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // HSTS (HTTPS 강제 - 배포 시)
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // 쿠키 보안 설정
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

// 추가적인 보안 헤더
app.use((req, res, next) => {
  // Permissions-Policy (기능 제어)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // X-Download-Options (IE)
  res.setHeader('X-Download-Options', 'noopen');
  
  next();
});
```

---

## ⚡ 중간 (Medium) 취약점

### 6. Path Traversal 가능성

**위험도:** 🟡 중간

**위치:** `server.js` - 라인 18-29

**문제:**
```javascript
app.get('/assessments/:assessmentId', (req, res) => {
  const assessmentId = req.params.assessmentId;
  const assessmentPages = {
    'mbti': 'assessments/mbti.html',
    'love-type': 'assessments/love-type.html',
    'career': 'assessments/career.html',
    'investment': 'assessments/investment.html'
  };

  const assessmentPath = assessmentPages[assessmentId];  // ⚠️ 정의되지 않은 키면 undefined
  if (assessmentPath) {
    res.sendFile(path.join(__dirname, 'public', assessmentPath));
  } else {
    res.status(404).send('분석을 찾을 수 없습니다.');
  }
});
```

**위험 시나리오:**
- 현재는 화이트리스트로 방지되어 있으나, 코드가 확장될 때 위험

**해결 방안:**
```javascript
// 화이트리스트 명시적 검증
const VALID_ASSESSMENTS = new Set(['mbti', 'love-type', 'career', 'investment']);

app.get('/assessments/:assessmentId', (req, res) => {
  const assessmentId = req.params.assessmentId;
  
  // 입력 검증
  if (!VALID_ASSESSMENTS.has(assessmentId)) {
    return res.status(400).send('잘못된 요청입니다.');
  }
  
  // 경로 검증
  const assessmentPath = `assessments/${assessmentId}.html`;
  const fullPath = path.join(__dirname, 'public', assessmentPath);
  
  // path traversal 방지
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    return res.status(403).send('접근 거부');
  }
  
  res.sendFile(fullPath);
});
```

---

### 7. CORS 설정 미흡

**위험도:** 🟡 중간

**위치:** `server.js`, `package.json`

**문제:**
```json
{
  "dependencies": {
    "cors": "^2.8.5"
  }
}
```
- CORS 패키지는 설치되어 있으나 사용되지 않음
- Vercel 배포 시 기본 CORS 설정에 의존

**해결 방안:**
```javascript
const cors = require('cors');

// 필요한 origin만 허용
const ALLOWED_ORIGINS = [
  'https://personahub.vercel.app',
  'https://personahub.com',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // 배포 환경에서는 origin 검증
    if (process.env.NODE_ENV === 'production') {
      if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('CORS 허용되지 않은 origin'));
      }
    } else {
      callback(null, true);  // 개발 환경에서는 모두 허용
    }
  },
  credentials: true,  // 필요한 경우
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 데이터 엔드포인트에 추가 제한
app.use('/data', cors({
  origin: ['self'],  // 같은 origin만 허용
  maxAge: 86400  // 24시간 preflight 캐시
}));
```

---

### 8. 사용자 입력 검증 부족

**위험도:** 🟡 중간

**위치:** 모든 JavaScript 파일

**문제:**
- 사용자 입력이나 localStorage 데이터 검증 없음
- 타입 체크 없음

**해결 방안:**
```javascript
// common.js에 유틸리티 추가
const PersonaHub = {
  // ... 기존 코드 ...

  /**
   * 문자열 검증
   */
  validateString: (value, maxLength = 1000) => {
    if (typeof value !== 'string') return false;
    if (value.length > maxLength) return false;
    // 위험 문자열 체크
    const dangerousPatterns = [
      /<script/i, /javascript:/i, /on\w+=/i,
      /data:text\/html/i
    ];
    return !dangerousPatterns.some(pattern => pattern.test(value));
  },

  /**
   * 객체 검증
   */
  validateObject: (value, schema = {}) => {
    if (!value || typeof value !== 'object') return false;
    
    // 스키마 기반 검증
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in value)) return false;
      if (typeof value[key] !== type) return false;
    }
    return true;
  },

  /**
   * 안전한 결과 저장 (검증 포함)
   */
  saveResult: (testId, result) => {
    // 입력 검증
    if (!PersonaHub.validateString(testId, 50)) {
      console.error('잘못된 testId');
      return false;
    }

    if (!PersonaHub.validateObject(result, {
      resultType: 'string',
      scores: 'object'
    })) {
      console.error('잘못된 result 형식');
      return false;
    }

    const results = PersonaHub.storage.get('results') || {};
    results[testId] = {
      ...result,
      resultType: PersonaHub.validateString(result.resultType) ? result.resultType : 'Unknown',
      completedAt: new Date().toISOString()
    };
    PersonaHub.storage.set('results', results);
    return true;
  }
};
```

---

## 📝 낮음 (Low) 우려 사항

### 9. 데이터 로드 시 취약성

**위험도:** 🟢 낮음

**위치:** `public/assessments/mbti.html` - 라인 83-100

**문제:**
```javascript
async function loadData() {
  try {
    const [questionsRes, typesRes] = await Promise.all([
      fetch('/data/mbti-questions.json'),
      fetch('/data/mbti-types.json')
    ]);

    questions = await questionsRes.json();  // ⚠️ 응답 검증 없음
    types = await typesRes.json();
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    alert('데이터를 불러오는 데 실패했습니다. 다시 시도해 주세요.');
  }
}
```

**해결 방안:**
```javascript
// 데이터 스키마 검증
const QUESTION_SCHEMA = {
  id: 'number',
  question: 'string',
  options: 'object'
};

const validateQuestion = (q) => {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.id !== 'number') return false;
  if (!PersonaHub.validateString(q.question)) return false;
  if (!Array.isArray(q.options)) return false;
  return q.options.every(opt => 
    typeof opt === 'object' &&
    PersonaHub.validateString(opt.text) &&
    PersonaHub.validateString(opt.dimension) &&
    typeof opt.value === 'number'
  );
};

async function loadData() {
  try {
    const [questionsRes, typesRes] = await Promise.all([
      fetch('/data/mbti-questions.json'),
      fetch('/data/mbti-types.json')
    ]);

    if (!questionsRes.ok || !typesRes.ok) {
      throw new Error('데이터 로드 실패');
    }

    const questionsData = await questionsRes.json();
    const typesData = await typesRes.json();

    // 데이터 검증
    if (!Array.isArray(questionsData) || !questionsData.every(validateQuestion)) {
      throw new Error('질문 데이터 형식 오류');
    }

    if (typeof typesData !== 'object') {
      throw new Error('결과 데이터 형식 오류');
    }

    questions = questionsData;
    types = typesData;

  } catch (error) {
    console.error('데이터 로드 실패:', error);
    // 사용자 친화적 에러 메시지
    document.getElementById('questionCard').innerHTML = `
      <div class="error-message">
        <h3>데이터를 불러오는 데 실패했습니다</h3>
        <p>다시 시도하거나 나중에 방문해 주세요.</p>
        <button onclick="location.reload()">다시 시도</button>
      </div>
    `;
  }
}
```

---

### 10. 환경 변수 관리

**위험도:** 🟢 낮음

**문제:**
- `.env` 파일이 없음 (보안에 좋음)
- 하지만 환경 변수 사용 패턴이 없음

**해결 방안:**
```javascript
// .env.example 생성
NODE_ENV=production
PORT=3000
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx

// server.js
const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.PORT || 3000;
const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT_ID;

// Vercel 배포 시
// vercel.json 생성
{
  "env": {
    "NODE_ENV": "production",
    "ADSENSE_CLIENT_ID": "@adsense-client-id"
  }
}
```

---

## 🚀 배포 보안 (Vercel)

### Vercel 배포 시 보안 고려사항

**1. Vercel 보안 헤더 설정:**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

**2. CSP 설정:**
```json
// vercel.json에 추가
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://tpc.googlesyndication.com;"
        }
      ]
    }
  ]
}
```

**3. HTTPS 강제:**
- Vercel은 기본적으로 HTTPS 제공
- HSTS 헤더 추가 권장

---

## ✅ 우선순위별 수정 사항

### P0 (즉시 수정 필수)
1. ✅ **CSP 헤더 추가** - XSS 공격 방지 핵심
2. ✅ **innerHTML 사용 제거 또는 sanitization** - XSS 취약점 해결
3. ✅ **HTTP 보안 헤더 추가** - helmet 미들웨어 적용

### P1 (최우선)
4. ✅ **localStorage 에러 처리 및 만료 메커니즘 추가**
5. ✅ **데이터 검증 함수 구현** (입력, JSON 응답)
6. ✅ **AdSense 코드 최적화** (로드 위치, 에러 핸들링)

### P2 (중요)
7. ✅ **CORS 설정 명시화**
8. ✅ **Path Traversal 방지 (화이트리스트 강화)**
9. ✅ **에러 핸들링 개선** (사용자 친화적)

### P3 (권장)
10. ✅ **환경 변수 활용**
11. ✅ **로깅 및 모니터링**
12. ✅ **CSP 위반 리포팅**

---

## 📊 수정 예상 결과

### 수정 전 보안 점수: 4/10

### 수정 후 보안 점수: 8/10

**개선 포인트:**
- XSS 취약점 완전 해결
- CSP 및 보안 헤더 적용으로 공격면 최소화
- localStorage 안전한 사용
- AdSense 보안 강화

---

## 🛠️ 구현 예시

### 전체 수정된 server.js:

```javascript
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const csp = require('helmet-csp');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 허용된 origin 목록
const ALLOWED_ORIGINS = [
  'https://personahub.vercel.app',
  'https://personahub.com',
  'http://localhost:3000'
];

// 허용된 assessment ID
const VALID_ASSESSMENTS = new Set(['mbti', 'love-type', 'career', 'investment']);

// CORS 설정
const corsOptions = {
  origin: (origin, callback) => {
    if (NODE_ENV === 'production') {
      if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('CORS 허용되지 않은 origin'));
      }
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: false,  // 직접 설정
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CSP 설정
app.use(csp({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://pagead2.googlesyndication.com'
    ],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    frameSrc: ["'self'", 'https://tpc.googlesyndication.com'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    reportUri: '/csp-violation-report'
  },
  reportOnly: false
}));

// CORS
app.use(cors(corsOptions));

// 추가 보안 헤더
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Download-Options', 'noopen');
  next();
});

// 정적 파일 제공 (보안 헤더 포함)
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 분석 페이지 (입력 검증 추가)
app.get('/assessments/:assessmentId', (req, res) => {
  const assessmentId = req.params.assessmentId;
  
  // 입력 검증
  if (!VALID_ASSESSMENTS.has(assessmentId)) {
    return res.status(400).send('잘못된 요청입니다.');
  }
  
  const assessmentPath = `assessments/${assessmentId}.html`;
  const fullPath = path.join(__dirname, 'public', assessmentPath);
  
  // path traversal 방지
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    return res.status(403).send('접근 거부');
  }
  
  res.sendFile(fullPath);
});

// 데이터 제공 (CORS 제한)
app.use('/data', cors({
  origin: ['self'],
  maxAge: 86400
}), express.static(path.join(__dirname, 'data')));

// CSP 위반 리포트 엔드포인트
app.post('/csp-violation-report', express.json(), (req, res) => {
  console.log('CSP 위반 리포트:', req.body);
  res.sendStatus(204);
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).send('서버 오류가 발생했습니다.');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`PersonaHub 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
  console.log(`환경: ${NODE_ENV}`);
});
```

---

## 📚 추가 권장 사항

### 1. 의존성 보안 스캔
```bash
npm install -g npm-check-updates
npm audit
npm audit fix
```

### 2. Lighthouse CI로 보안 점수 확인
```bash
npm install -g @lhci/cli
lhci autorun
```

### 3. 정적 분석 도구
```bash
npm install -g eslint eslint-plugin-security
npx eslint public/**/*.js --plugin security
```

### 4. AdSense 대안 고려
- 더 안전한 광고 플랫폼 고려 (Carbon, BuySellAds)
- 광고를 제외하고 다른 수익 모델 고려

---

## 🎯 결론

PersonaHub는 개인정보를 수집하지 않고 클라이언트 사이드에서 실행되기 때문에 보안 리스크가 비교적 낮습니다. 그러나 **CSP, 보안 헤더, XSS 방지** 같은 기본적인 웹 보안 표준을 적용하여 공격면을 최소화할 필요가 있습니다.

**P0 수정 사항**을 적용하면 보안 점수를 4/10에서 7/10으로 향상할 수 있으며, 전체 수정 후 8/10까지 도달 가능합니다.

---

## 📞 문의

보안 관련 추가 문의사항은 프로젝트 메인테이너에게 문의해 주세요.
