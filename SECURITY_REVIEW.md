# PersonaHub 시큐어 코딩 리뷰 보고서

**리뷰 일자:** 2026년 2월 3일
**프로젝트:** PersonaHub (다중 성격 분석 허브)
**기술스택:** Express.js, HTML5, CSS, JavaScript (Vanilla), localStorage
**배포:** Vercel

---

## 🔒 보안 점수: **4/10**

### 점수 기준:
- 1-3점: 심각한 보안 취약점 (즉시 수정 필요)
- 4-6점: 중간 수준의 보안 이슈 (개선 권장)
- 7-9점: 양호한 보안 수준 (미세한 개선)
- 10점: 우수한 보안 수준

---

## 1. ⚠️ 보안 취약점 상세 분석

### 🔴 심각 (Critical)

#### 1.1 XSS (Cross-Site Scripting) 취약점

**위치:** 
- `/public/index.html` (라인 190-202)
- `/public/assessments/*.html` (모든 결과 표시 섹션)

**문제점:**
```javascript
// common.js - createElement 메서드
createElement: (tag, className, content = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.innerHTML = content;  // ⚠️ XSS 취약!
  return element;
}
```

```javascript
// mbti.html (라인 170-172)
document.getElementById('resultEmoji').textContent = typeData.emoji;
document.getElementById('resultType').textContent = `${mbti} - ${typeData.name}`;  // ⚠️ 안전
document.getElementById('resultTitle').textContent = typeData.title;  // ⚠️ 안전
```

하지만 아래와 같은 코드가 있습니다:
```javascript
// index.html (라인 190-202)
recentAssessmentsList.innerHTML = sortedResults.map(([assessmentId, result]) => `
  <div class="recent-assessment-item">
    <div class="recent-assessment-info">
      <span class="recent-assessment-icon">${assessmentIcons[assessmentId] || '📝'}</span>
      <div>
        <div class="recent-assessment-name">${assessmentNames[assessmentId] || assessmentId}</div>
        <!-- ⚠️ assessmentId가 XSS에 사용될 수 있음 -->
      </div>
    </div>
  </div>
`).join('');
```

**위험도:** 높음 (localStorage 데이터가 오염될 경우 XSS 실행 가능)

**영향:**
- 공격자가 localStorage를 조작하여 악성 스크립트 실행 가능
- 사용자 세션 탈취, 쿠키 도용 가능
- 피싱 공격 가능

---

#### 1.2 Path Traversal 취약점

**위치:** `/server.js` (라인 19-28)

**문제점:**
```javascript
app.get('/assessments/:assessmentId', (req, res) => {
    const assessmentId = req.params.assessmentId;
    const assessmentPages = {
        'mbti': 'assessments/mbti.html',
        'love-type': 'assessments/love-type.html',
        'career': 'assessments/career.html',
        'investment': 'assessments/investment.html'
    };

    const assessmentPath = assessmentPages[assessmentId];
    if (assessmentPath) {
        res.sendFile(path.join(__dirname, 'public', assessmentPath));
    } else {
        res.status(404).send('분석을 찾을 수 없습니다.');
    }
});
```

**현황:** 백리스트(whitelist) 방식으로 구현되어 있어 현재는 안전함

**하지만:**
```javascript
app.use('/data', express.static(path.join(__dirname, 'data')));
```

**위험도:** 중간
- `/data/` 경로를 통해 모든 JSON 파일 접근 가능
- 민감한 구성 정보나 개발용 데이터가 포함될 위험

---

#### 1.3 Content Security Policy (CSP) 부재

**위치:** `/server.js`

**문제점:** 어떠한 CSP 헤더도 설정되어 있지 않음

**위험도:** 높음
- XSS 공격 시 실행될 수 있음
- 데이터 탈취 가능
- 외부 악성 스크립트 로드 가능

---

### 🟡 중간 (Medium)

#### 2.1 AdSense 코드 보안 문제

**위치:** 모든 HTML 파일의 AdSense 섹션

**문제점:**
```html
<script async src="https://pagead2.googlesydication.com/pagead/js/adsbygoogle.js?client=ca-pub-4896634202351610" crossorigin="anonymous"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-4896634202351610"
     data-ad-slot="5187796078"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

**위험도:** 중간
- AdSense는 신뢰할 수 있는 출처이지만, 광고를 통한 악성 스크립트 주입 가능성
- CSP 없이 내부 스크립트 실행 허용

---

#### 2.2 HTTP 헤더 보안 부재

**위치:** `/server.js`

**문제점:** 다음 보안 헤더들이 누락됨
```javascript
// 현재 코드: 없음
```

**필요한 헤더:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` 또는 `SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

---

#### 2.3 CORS 설정 미흡

**위치:** `/server.js` 및 `package.json`

**문제점:**
```javascript
// server.js에는 CORS 미들웨어 사용 안함
// 하지만 package.json에는 의존성이 있음:
"dependencies": {
  "express": "^4.18.2",
  "cors": "^2.8.5"  // 설치되어 있지만 사용 안 함
}
```

**위험도:** 낮음 (현재 API 엔드포인트 없음)
- 향후 API 추가 시 CORS 설정이 필요할 수 있음

---

### 🟢 낮음 (Low)

#### 3.1 localStorage 보안 고려사항

**위치:** `/public/common.js` (라인 20-36)

**현황:**
```javascript
storage: {
  set: (key, value) => {
    localStorage.setItem(`personaHub_${key}`, JSON.stringify(value));
  },
  get: (key) => {
    const item = localStorage.getItem(`personaHub_${key}`);
    return item ? JSON.parse(item) : null;
  },
  // ...
}
```

**문제점:**
- 모든 데이터가 클라이언트에 저장됨 (서버 없이 접근 가능)
- XSS 공격 시 데이터 탈취 가능
- 브라우저 캐시/프라이빗 모드에서 동작하지 않을 수 있음

**위험도:** 낮음 (테스트 결과만 저장)

---

#### 3.2 JSON 데이터 로드 시 검증 부재

**위치:** 모든 assessment 페이지

**문제점:**
```javascript
// mbti.html
async function loadData() {
  try {
    const [questionsRes, typesRes] = await Promise.all([
      fetch('/data/mbti-questions.json'),
      fetch('/data/mbti-types.json')
    ]);

    questions = await questionsRes.json();  // ⚠️ 데이터 검증 없음
    types = await typesRes.json();  // ⚠️ 데이터 검증 없음
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    alert('데이터를 불러오는 데 실패했습니다. 다시 시도해 주세요.');
  }
}
```

**위험도:** 낮음
- 정적 파일이므로 위험 낮음
- 하지만 스키마 검증 추가 권장

---

#### 3.3 입력 처리 및 검증

**위치:** `/public/assessments/*.html`

**현황:**
```javascript
// 사용자 선택 옵션 처리
function selectOption(optIndex, option) {
  answers[currentQuestion] = { optIndex, option };
  // 검증 없음
}
```

**위험도:** 낮음
- 하드코딩된 옵션만 선택 가능
- 하지만 공통 라이브러리에 검증 메서드 추가 권장

---

## 2. 📋 데이터 처리 검토

### 2.1 localStorage 사용

**장점:**
- 클라이언트 측 데이터 저장으로 서버 부하 감소
- 오프라인 기능 지원
- 구현 간편

**단점:**
- 보안: XSS에 취약
- 프라이빗 모드/캐시 삭제 시 데이터 손실
- 용량 제한 (보통 5-10MB)
- 브라우저 간 동기화 불가

**현재 사용:**
```javascript
// common.js
saveResult: (testId, result) => {
  const results = PersonaHub.storage.get('results') || {};
  results[testId] = {
    ...result,
    completedAt: new Date().toISOString()
  };
  PersonaHub.storage.set('results', results);
}
```

**권장사항:**
- 테스트 결과는 localStorage 사용 OK
- 민감 정보는 절대 저장하지 않음
- 데이터 유효성 검증 추가

---

### 2.2 JSON 데이터 로드

**현재 구현:**
- 정적 JSON 파일을 `/data/` 경로에서 직접 제공
- `fetch()` API를 통해 클라이언트에서 로드

**보안 고려사항:**
```javascript
// 현재 코드 (검증 없음)
questions = await questionsRes.json();
types = await typesRes.json();
```

**권장사항:**
1. 데이터 스키마 정의
2. 로드 시 데이터 구조 검증
3. 오류 처리 개선

---

## 3. 🔐 API/라우트 보안

### 3.1 Express.js 라우트 보안

**현재 상태:**
```javascript
// server.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 분석 페이지 (백리스트 방식 - 좋음)
app.get('/assessments/:assessmentId', (req, res) => {
    const assessmentId = req.params.assessmentId;
    const assessmentPages = {
        'mbti': 'assessments/mbti.html',
        'love-type': 'assessments/love-type.html',
        'career': 'assessments/career.html',
        'investment': 'assessments/investment.html'
    };

    const assessmentPath = assessmentPages[assessmentId];
    if (assessmentPath) {
        res.sendFile(path.join(__dirname, 'public', assessmentPath));
    } else {
        res.status(404).send('분석을 찾을 수 없습니다.');
    }
});

// 데이터 제공
app.use('/data', express.static(path.join(__dirname, 'data')));

// 서버 시작
app.listen(PORT, () => {
    console.log(`PersonaHub 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});
```

**보안 문제:**
1. 보안 헤더 없음
2. 레이트 리미팅 없음
3. 요청 로깅 없음
4. 에러 처리 부족
5. CSP 없음

---

## 4. 🌐 배포 보안 (Vercel)

### 4.1 Vercel 배포 시 보안 고려사항

**장점:**
- 기본 HTTPS 강제
- DDoS 방어
- 글로벌 CDN
- 자동 SSL 인증서

**현재 설정:** 없음 (vercel.json 없음)

---

## 5. 🔧 보안 문제 해결 방안

### 5.1 XSS 방지 (최우선)

#### 방안 1: HTML Escaping 유틸리티 추가

```javascript
// security.js (새 파일 생성)
const Security = {
  /**
   * HTML 엔티티 이스케이프
   */
  escapeHtml: (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe;
    
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * URL 파라미터 검증
   */
  validateId: (id) => {
    // 영문 소문자, 숫자, 하이픈만 허용
    const regex = /^[a-z0-9-]+$/;
    return regex.test(id);
  },

  /**
   * 안전한 HTML 요소 생성
   */
  safeCreateElement: (tag, className, content = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) {
      // innerHTML 대신 textContent 사용
      element.textContent = content;
    }
    return element;
  }
};
```

#### 방안 2: index.html 수정

```javascript
// index.html 수정
const sortedResults = Object.entries(results)
  .sort((a, b) => new Date(b[1].completedAt) - new Date(a[1].completedAt))
  .slice(0, 5);

recentAssessmentsList.innerHTML = sortedResults.map(([assessmentId, result]) => {
  // 검증
  if (!Security.validateId(assessmentId)) return '';
  
  const safeId = Security.escapeHtml(assessmentId);
  const safeResultType = Security.escapeHtml(result.resultType || '');
  const safeAssessmentName = Security.escapeHtml(assessmentNames[assessmentId] || assessmentId);
  const safeIcon = Security.escapeHtml(assessmentIcons[assessmentId] || '📝');

  return `
    <div class="recent-assessment-item">
      <div class="recent-assessment-info">
        <span class="recent-assessment-icon">${safeIcon}</span>
        <div>
          <div class="recent-assessment-name">${safeAssessmentName}</div>
          <div class="recent-assessment-date">${PersonaHub.formatDate(result.completedAt)}</div>
        </div>
      </div>
      <span class="recent-assessment-result">${safeResultType}</span>
    </div>
  `;
}).join('');
```

#### 방안 3: 모든 innerHTML 사용 위치 검토 및 수정

```javascript
// 나쁜 예시
element.innerHTML = userContent;

// 좋은 예시 1: textContent 사용
element.textContent = userContent;

// 좋은 예시 2: 이스케이프 후 innerHTML
element.innerHTML = Security.escapeHtml(userContent);

// 좋은 예시 3: createElement 사용
const span = document.createElement('span');
span.textContent = userContent;
element.appendChild(span);
```

---

### 5.2 CSP (Content Security Policy) 추가

#### server.js 수정

```javascript
const express = require('express');
const path = require('path');
const helmet = require('helmet');  // 보안 헬퍼 라이브러리
const app = express();

// CSP 설정
const CSP_POLICY = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",  // 개발용, 프로덕션에서 제거 권장
      "https://pagead2.googlesyndication.com"  // AdSense
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:"
    ],
    frameSrc: [
      "https://googleads.g.doubleclick.net"  // AdSense iframe
    ],
    connectSrc: [
      "'self'"
    ],
    fontSrc: [
      "'self'",
      "data:"
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: []
  }
};

// 헬멧 미들웨어 (보안 헤더)
app.use(helmet({
  contentSecurityPolicy: CSP_POLICY,
  crossOriginEmbedderPolicy: false  // AdSense 호환성을 위해
}));

// 추가 보안 헤더
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 나머지 코드...
```

**package.json에 helmet 추가:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5"
  }
}
```

**설치:**
```bash
npm install helmet
```

---

### 5.3 HTTP 보안 헤더 완전 구현

#### server.js에 추가

```javascript
// 보안 헤더 미들웨어
const securityHeaders = (req, res, next) => {
  // Content-Type nosniff
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking 방지
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS 필터
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HTTPS 강제 (Vercel에서 자동 설정되지만 명시적으로 추가)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Referrer 정책
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 권한 정책
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

app.use(securityHeaders);
```

---

### 5.4 Path Traversal 방지 강화

#### server.js 수정

```javascript
// 분석 페이지 라우트 개선
app.get('/assessments/:assessmentId', (req, res) => {
  const assessmentId = req.params.assessmentId;
  
  // ID 검증 (영문 소문자, 숫자, 하이픈만 허용)
  const idRegex = /^[a-z0-9-]+$/;
  if (!idRegex.test(assessmentId)) {
    return res.status(400).send('유효하지 않은 분석 ID입니다.');
  }

  const assessmentPages = {
    'mbti': 'assessments/mbti.html',
    'love-type': 'assessments/love-type.html',
    'career': 'assessments/career.html',
    'investment': 'assessments/investment.html'
  };

  const assessmentPath = assessmentPages[assessmentId];
  
  if (!assessmentPath) {
    return res.status(404).send('분석을 찾을 수 없습니다.');
  }

  // 경로 정규화 및 확인
  const fullPath = path.normalize(path.join(__dirname, 'public', assessmentPath));
  const publicDir = path.normalize(path.join(__dirname, 'public'));

  if (!fullPath.startsWith(publicDir)) {
    return res.status(403).send('접근이 거부되었습니다.');
  }

  res.sendFile(fullPath);
});

// /data 경로에 대한 접근 제한
app.use('/data', express.static(path.join(__dirname, 'data'), {
  // 필요한 파일만 허용
  setHeaders: (res, filePath) => {
    // JSON 파일만 허용
    if (!filePath.endsWith('.json')) {
      return res.status(403).end();
    }
    res.setHeader('Content-Type', 'application/json');
  }
}));
```

---

### 5.5 localStorage 보안 강화

#### common.js 수정

```javascript
storage: {
  set: (key, value) => {
    try {
      // 키 검증
      const keyRegex = /^[a-z0-9_-]+$/i;
      if (!keyRegex.test(key)) {
        console.error('Invalid storage key:', key);
        return false;
      }

      // 값 타입 검증
      if (value === null || value === undefined) {
        return false;
      }

      // 데이터 크기 제한 (1MB)
      const serialized = JSON.stringify(value);
      if (serialized.length > 1024 * 1024) {
        console.error('Storage value too large');
        return false;
      }

      localStorage.setItem(`personaHub_${key}`, serialized);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },

  get: (key) => {
    try {
      const keyRegex = /^[a-z0-9_-]+$/i;
      if (!keyRegex.test(key)) {
        return null;
      }

      const item = localStorage.getItem(`personaHub_${key}`);
      
      if (!item) return null;

      const parsed = JSON.parse(item);
      
      // 데이터 구조 검증 (예: results 객체)
      if (key === 'results') {
        if (typeof parsed !== 'object' || parsed === null) {
          return {};
        }
        // 각 결과 항목 검증
        for (const [testId, result] of Object.entries(parsed)) {
          if (!result || typeof result !== 'object') {
            delete parsed[testId];
          }
        }
      }
      
      return parsed;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  remove: (key) => {
    try {
      const keyRegex = /^[a-z0-9_-]+$/i;
      if (!keyRegex.test(key)) {
        return false;
      }
      localStorage.removeItem(`personaHub_${key}`);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },

  clear: () => {
    try {
      const prefix = 'personaHub_';
      Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
}
```

---

### 5.6 입력 검증 및 데이터 검증

#### assessment-engine.js에 검증 추가

```javascript
class TestEngine {
  // ... 기존 코드 ...

  /**
   * 답변 저장 (검증 추가)
   */
  saveAnswer(questionIndex, answerValue) {
    // 질문 인덱스 검증
    if (typeof questionIndex !== 'number' || 
        questionIndex < 0 || 
        questionIndex >= this.config.questions.length) {
      throw new Error(`Invalid question index: ${questionIndex}`);
    }

    // 답변 값 검증
    if (answerValue !== null && 
        answerValue !== undefined && 
        typeof answerValue !== 'string' && 
        typeof answerValue !== 'number') {
      throw new Error(`Invalid answer value: ${answerValue}`);
    }

    this.answers[questionIndex] = {
      questionIndex,
      answerValue,
      skipped: answerValue === null || answerValue === undefined
    };

    if (answerValue === null || answerValue === undefined) {
      this.skippedCount++;
    }
  }
}
```

---

### 5.7 JSON 데이터 스키마 검증

#### data-loader.js (새 파일)

```javascript
/**
 * 데이터 스키마 및 검증
 */

const DataValidator = {
  /**
   * 질문 데이터 검증
   */
  validateQuestions: (questions) => {
    if (!Array.isArray(questions)) {
      throw new Error('Questions must be an array');
    }

    return questions.every((q, index) => {
      // 필수 필드 확인
      if (typeof q.id !== 'number') {
        console.error(`Question ${index}: Missing or invalid id`);
        return false;
      }

      if (typeof q.question !== 'string' || q.question.trim() === '') {
        console.error(`Question ${index}: Missing or invalid question text`);
        return false;
      }

      if (!Array.isArray(q.options) || q.options.length === 0) {
        console.error(`Question ${index}: Missing or invalid options`);
        return false;
      }

      // 옵션 검증
      return q.options.every((opt, optIndex) => {
        if (typeof opt.text !== 'string' || opt.text.trim() === '') {
          console.error(`Question ${index}, Option ${optIndex}: Missing text`);
          return false;
        }

        if (typeof opt.dimension !== 'string' || opt.dimension.trim() === '') {
          console.error(`Question ${index}, Option ${optIndex}: Missing dimension`);
          return false;
        }

        if (typeof opt.value !== 'number') {
          console.error(`Question ${index}, Option ${optIndex}: Missing or invalid value`);
          return false;
        }

        return true;
      });
    });
  },

  /**
   * 유형 데이터 검증
   */
  validateTypes: (types) => {
    if (typeof types !== 'object' || types === null) {
      throw new Error('Types must be an object');
    }

    return Object.keys(types).every(typeKey => {
      const type = types[typeKey];

      if (typeof type.name !== 'string' || type.name.trim() === '') {
        console.error(`Type ${typeKey}: Missing name`);
        return false;
      }

      if (typeof type.title !== 'string' || type.title.trim() === '') {
        console.error(`Type ${typeKey}: Missing title`);
        return false;
      }

      if (typeof type.description !== 'string' || type.description.trim() === '') {
        console.error(`Type ${typeKey}: Missing description`);
        return false;
      }

      if (typeof type.emoji !== 'string' || type.emoji.trim() === '') {
        console.error(`Type ${typeKey}: Missing emoji`);
        return false;
      }

      return true;
    });
  },

  /**
   * 데이터 로드 및 검증
   */
  async loadAndValidate(url, validator) {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const data = await response.json();
    
    if (!validator(data)) {
      throw new Error(`Data validation failed for ${url}`);
    }

    return data;
  }
};
```

#### assessment 페이지에서 사용

```javascript
// mbti.html 수정
async function loadData() {
  try {
    const [questions, types] = await Promise.all([
      DataValidator.loadAndValidate('/data/mbti-questions.json', DataValidator.validateQuestions),
      DataValidator.loadAndValidate('/data/mbti-types.json', DataValidator.validateTypes)
    ]);

    window.questions = questions;
    window.types = types;

    document.getElementById('totalQ').textContent = questions.length;
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    alert('데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
    // 에러 페이지로 리다이렉트 또는 대체 동작
  }
}
```

---

### 5.8 Vercel 배포 보안 설정

#### vercel.json 생성

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/data/(.*)",
      "headers": {
        "Cache-Control": "public, max-age=3600, s-maxage=86400"
      }
    },
    {
      "src": "/(.*)",
      "headers": {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    }
  ],
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
        }
      ]
    }
  ]
}
```

#### .env.example (환경 변수 템플릿)

```env
# 서버 설정
PORT=3000
NODE_ENV=production

# 보안 설정
ENABLE_DEBUG=false

# AdSense (Vercel 환경 변수에서 설정)
GOOGLE_ADSENSE_CLIENT_ID=ca-pub-4896634202351610
```

#### .env.local (개발용)

```env
PORT=3000
NODE_ENV=development
ENABLE_DEBUG=true
```

**.gitignore에 .env.local 추가:**
```gitignore
node_modules/
.env.local
.env.production
```

---

## 6. ✅ 보안 모범 사례 적용 권장

### 6.1 우선순위 기준

#### 🔴 즉시 적용 (P0 - Critical)
1. **XSS 방지** - HTML 이스케이프 유틸리티 구현
2. **CSP 추가** - Content Security Policy 설정
3. **보안 헤더** - Helmet 미들웨어 추가

#### 🟡 빠른 시간 내 적용 (P1 - High)
4. **Path Traversal 방지** - ID 검증 강화
5. **localStorage 보안** - 데이터 검증 추가
6. **JSON 데이터 검증** - 스키마 검증 구현

#### 🟢 단계적 적용 (P2 - Medium)
7. **Vercel 설정** - vercel.json 생성
8. **환경 변수 관리** - .env 파일 구조화
9. **로그 및 모니터링** - 에러 추적 시스템

---

### 6.2 개발 프로세스 개선

#### 보안 체크리스트

- [ ] 사용자 입력은 항상 검증
- [ ] innerHTML 대신 textContent 사용
- [ ] 모든 동적 콘텐츠는 이스케이프
- [ ] CSP 헤더 설정
- [ ] 보안 관련 라이브러리 사용 (helmet 등)
- [ ] 종속성 주기적 업데이트
- [ ] 취약점 스캔 도구 사용

---

### 6.3 권장 라이브러리

```bash
# 보안 헬퍼
npm install helmet

# 입력 검증 (향후 API 추가 시)
npm install express-validator

# Rate Limiting (향후 필요 시)
npm install express-rate-limit

# CORS (이미 설치됨)
npm install cors

# HTTP 보안 헤더 (helmet으로 대체 가능)
# npm install hpp
```

---

## 7. 📊 보안 점수 개선 시나리오

### 현재 점수: 4/10

### 단계별 개선 후 예상 점수:

#### 1단계: XSS 및 CSP 수정
- XSS 방지: HTML 이스케이프 구현
- CSP 헤더 추가
- **예상 점수: 6/10**

#### 2단계: 보안 헤더 완전 구현
- Helmet 미들웨어
- 모든 보안 헤더 추가
- Path Traversal 방지 강화
- **예상 점수: 7/10**

#### 3단계: 데이터 검증 및 Vercel 설정
- JSON 스키마 검증
- localStorage 보안 강화
- vercel.json 설정
- **예상 점수: 8/10**

#### 4단계: 추가 보안 강화
- Rate Limiting (향후 API 시)
- 에러 로깅 및 모니터링
- 종속성 정기 업데이트
- **예상 점수: 9/10**

---

## 8. 🎯 결론

### 요약

PersonaHub 프로젝트는 기본 기능이 잘 구현되어 있으나, 보안 측면에서 개선이 필요합니다. 특히 **XSS 방지**와 **Content Security Policy** 설정이 시급합니다.

### 핵심 발견사항

1. **XSS 취약점:** innerHTML 사용으로 인한 사용자 입력 이스케이핑 부재
2. **CSP 부재:** 콘텐츠 보안 정책이 전혀 설정되어 있지 않음
3. **보안 헤더 누락:** Helmet 등 보안 미들웨어 사용 안 함
4. **Path Traversal:** /data 경로의 모든 JSON 파일 접근 가능
5. **localStorage 보안:** 데이터 검증이 부족함

### 권장사항

1. **즉시:** HTML 이스케이프 유틸리티 구현, CSP 헤더 추가
2. **빠르게:** Helmet 미들웨어 추가, 보안 헤더 완전 구현
3. **단계적:** JSON 데이터 검증, Vercel 설정 구축

### 최종 평가

현재 4/10점의 보안 점수를 **8-9/10점**으로 향상시킬 수 있습니다. 테스트 결과만 저장하는 localStorage 방식과 정적 파일 구조는 보안 관점에서 장점이므로, 위의 개선사항들을 적용하면 안전한 웹 애플리케이션으로 발전할 수 있습니다.

---

## 9. 📞 연락처

이 보고서에 대한 문의사항이 있거나 추가적인 보안 검토가 필요하시면 연락 주시기 바랍니다.

---

**작성자:** 시큐어 코딩 리뷰 서브에이전트
**작성일:** 2026년 2월 3일
**버전:** 1.0
