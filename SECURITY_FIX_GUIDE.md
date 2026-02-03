# PersonaHub 보안 수정 가이드

이 가이드는 `SECURITY_REVIEW_2026-02-03.md`에서 식별된 보안 취약점을 수정하는 단계별 지침입니다.

---

## 📦 필요한 패키지 설치

```bash
cd /home/ubuntu/clawd/PersonaHub
npm install helmet helmet-csp dotenv
npm install --save-dev dompurify
```

---

## 🔧 1단계: server.js 수정

**파일:** `server.js`

**변경 내용:**
- 보안 헤더 추가 (helmet)
- CSP 설정
- CORS 설정
- 입력 검증

**수정된 코드:**

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
  contentSecurityPolicy: false,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CSP 설정
app.use(csp({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://pagead2.googlesyndication.com'],
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

app.use(cors(corsOptions));

// 추가 보안 헤더
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Download-Options', 'noopen');
  next();
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 분석 페이지 (입력 검증 추가)
app.get('/assessments/:assessmentId', (req, res) => {
  const assessmentId = req.params.assessmentId;
  
  if (!VALID_ASSESSMENTS.has(assessmentId)) {
    return res.status(400).send('잘못된 요청입니다.');
  }
  
  const assessmentPath = `assessments/${assessmentId}.html`;
  const fullPath = path.join(__dirname, 'public', assessmentPath);
  
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    return res.status(403).send('접근 거부');
  }
  
  res.sendFile(fullPath);
});

// 데이터 제공
app.use('/data', cors({ origin: ['self'], maxAge: 86400 }), 
  express.static(path.join(__dirname, 'data')));

// CSP 위반 리포트
app.post('/csp-violation-report', express.json(), (req, res) => {
  console.log('CSP 위반 리포트:', req.body);
  res.sendStatus(204);
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).send('서버 오류가 발생했습니다.');
});

app.listen(PORT, () => {
  console.log(`PersonaHub 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});
```

---

## 🛡️ 2단계: common.js 수정

**파일:** `public/common.js`

**변경 내용:**
- localStorage 에러 처리 추가
- 데이터 만료 기능 추가
- 입력 검증 함수 추가

**추가할 코드:**

```javascript
// 기존 PersonaHub 객체 내부에 추가

/**
 * 문자열 검증
 */
validateString: (value, maxLength = 1000) => {
  if (typeof value !== 'string') return false;
  if (value.length > maxLength) return false;
  const dangerousPatterns = [
    /<script/i, /javascript:/i, /on\w+=/i, /data:text\/html/i
  ];
  return !dangerousPatterns.some(pattern => pattern.test(value));
},

/**
 * 객체 검증
 */
validateObject: (value, schema = {}) => {
  if (!value || typeof value !== 'object') return false;
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in value)) return false;
    if (typeof value[key] !== type) return false;
  }
  return true;
},

/**
 * 텍스트 안전하게 이스케이프
 */
escapeHtml: (text) => {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
},
```

**storage 객체 수정:**

```javascript
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
      
      // 30일 만료 체크
      const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > MAX_AGE) {
        PersonaHub.storage.remove(key);
        return null;
      }

      return parsed.value;
    } catch (e) {
      console.error('localStorage 읽기 실패:', e);
      return null;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(`personaHub_${key}`);
    } catch (e) {
      console.error('localStorage 삭제 실패:', e);
    }
  },
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('personaHub_'))
        .forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error('localStorage 초기화 실패:', e);
    }
  }
},

/**
 * 안전한 결과 저장
 */
saveResult: (testId, result) => {
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
},
```

---

## 🔒 3단계: index.html 수정

**파일:** `public/index.html`

**변경 내용:**
- innerHTML 사용 제거 → DOM API 사용

**수정할 코드 (라인 180-200):**

**변경 전:**
```javascript
recentAssessmentsList.innerHTML = sortedResults.map(([assessmentId, result]) => `
  <div class="recent-assessment-item">
    <div class="recent-assessment-info">
      <span class="recent-assessment-icon">${assessmentIcons[assessmentId] || '📝'}</span>
      <div>
        <div class="recent-assessment-name">${assessmentNames[assessmentId] || assessmentId}</div>
        <div class="recent-assessment-date">${PersonaHub.formatDate(result.completedAt)}</div>
      </div>
    </div>
    <span class="recent-assessment-result">${result.resultType}</span>
  </div>
`).join('');
```

**변경 후:**
```javascript
// 기존 내용 비우기
recentAssessmentsList.innerHTML = '';

// 안전한 DOM 생성
sortedResults.forEach(([assessmentId, result]) => {
  const item = document.createElement('div');
  item.className = 'recent-assessment-item';

  const info = document.createElement('div');
  info.className = 'recent-assessment-info';

  const icon = document.createElement('span');
  icon.className = 'recent-assessment-icon';
  icon.textContent = assessmentIcons[assessmentId] || '📝';

  const div = document.createElement('div');

  const name = document.createElement('div');
  name.className = 'recent-assessment-name';
  name.textContent = assessmentNames[assessmentId] || assessmentId;

  const date = document.createElement('div');
  date.className = 'recent-assessment-date';
  date.textContent = PersonaHub.formatDate(result.completedAt);

  div.appendChild(name);
  div.appendChild(date);
  info.appendChild(icon);
  info.appendChild(div);

  const resultSpan = document.createElement('span');
  resultSpan.className = 'recent-assessment-result';
  resultSpan.textContent = result.resultType || 'Unknown';

  item.appendChild(info);
  item.appendChild(resultSpan);
  recentAssessmentsList.appendChild(item);
});
```

---

## 📄 4단계: vercel.json 생성

**새 파일:** `vercel.json`

```json
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
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://tpc.googlesyndication.com;"
        }
      ]
    }
  ]
}
```

---

## 📝 5단계: .env.example 생성

**새 파일:** `.env.example`

```env
NODE_ENV=production
PORT=3000
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
```

---

## 📦 6단계: package.json 업데이트

**파일:** `package.json`

**변경 내용:**
- 새로운 의존성 추가
- 보안 스크립트 추가

**업데이트된 package.json:**

```json
{
  "name": "persona-hub",
  "version": "1.0.0",
  "description": "다중 테스트 허브 - MBTI, 연애, 진로, 투자 등",
  "main": "index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "security-audit": "npm audit",
    "security-fix": "npm audit fix",
    "lint": "eslint public/**/*.js"
  },
  "keywords": [
    "persona",
    "test",
    "mbti",
    "psychology"
  ],
  "author": "Molt Company",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "helmet-csp": "^3.4.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "dompurify": "^3.0.6"
  }
}
```

---

## ✅ 7단계: 테스트

```bash
# 의존성 설치
npm install

# 보안 감사 실행
npm run security-audit

# 서버 시작
npm start

# 브라우저에서 테스트
# - http://localhost:3000
# - 개발자 도구 > Network 헤더 확인
# - 개발자 도구 > Console 확인
```

---

## 📊 검증 체크리스트

### 보안 헤더 확인
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy 설정됨
- [ ] Permissions-Policy 설정됨
- [ ] CSP 헤더 설정됨

### 기능 확인
- [ ] 모든 분석 페이지 정상 작동
- [ ] localStorage 저장/로드 정상
- [ ] 데이터 로드 에러 처리 작동
- [ ] CORS 설정 작동 (프로덕션)

### CSP 확인
- [ ] 스크립트 로드 정상
- [ ] 스타일 로드 정상
- [ ] 이미지 로드 정상
- [ ] AdSense 로드 정상

---

## 🎯 최종 확인

모든 수정 사항 적용 후:

```bash
# 보안 점수 재확인
npm run security-audit

# Lighthouse 점수 확인
# Chrome DevTools > Lighthouse > Security

# 배포
vercel --prod
```

---

## 📞 문제 발생 시

문제가 발생하면 다음을 확인하세요:
1. node_modules 삭제 후 재설치: `rm -rf node_modules && npm install`
2. �시 클리어: Chrome DevTools > Application > Clear storage
3. CSP 헤더 확인: Chrome DevTools > Network > 응답 헤더
