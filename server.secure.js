/**
 * PersonaHub Server - 보안 강화 버전
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================================================
// 보안 설정
// ============================================================================

// 1. Content Security Policy (CSP)
const CSP_POLICY = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      isDevelopment ? "'unsafe-inline'" : null,  // 개발용만 unsafe-inline 허용
      "'unsafe-eval'",  // 필요한 경우에만 (없앨수록 좋음)
      "https://pagead2.googlesyndication.com",
      "https://www.googletagmanager.com"
    ].filter(Boolean),
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com"
    ].filter(Boolean),
    imgSrc: [
      "'self'",
      "data:",
      "https:",
      "https://www.googletagmanager.com"
    ].filter(Boolean),
    frameSrc: [
      "https://googleads.g.doubleclick.net",
      "https://tpc.googlesyndication.com"
    ].filter(Boolean),
    connectSrc: [
      "'self'",
      "https://www.googletagmanager.com"
    ].filter(Boolean),
    fontSrc: [
      "'self'",
      "data:",
      "https://fonts.gstatic.com"
    ].filter(Boolean),
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: []
  }
};

// 2. Helmet 미들웨어 (보안 헤더)
app.use(helmet({
  contentSecurityPolicy: CSP_POLICY,
  crossOriginEmbedderPolicy: false,  // AdSense 호환성을 위해
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  hsts: isDevelopment ? false : {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 3. 추가 보안 헤더
app.use((req, res, next) => {
  // Content-Type nosniff
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking 방지
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS 필터
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer 정책
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 권한 정책 (민감한 기능 비활성화)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  
  // Content-Disposition 다운로드 방지
  res.setHeader('X-Download-Options', 'noopen');
  
  next();
});

// 4. CORS 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: false,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 5. Rate Limiting (DOS 공격 방지)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 100,  // IP당 최대 100개 요청
  message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해 주세요.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 정적 파일은 제한하지 않음
    return req.path.startsWith('/public/') || 
           req.path.startsWith('/data/') ||
           req.path.startsWith('/css/') ||
           req.path.startsWith('/js/');
  }
});

app.use('/api', limiter);  // API 엔드포인트에만 적용 (향후)

// 6. 요청 로깅
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    if (isDevelopment) {
      console.log(`[${logEntry.timestamp}] ${logEntry.method} ${logEntry.url} ${logEntry.status} - ${logEntry.duration}`);
    }
  });
  
  next();
});

// ============================================================================
// 정적 파일 제공
// ============================================================================

// 공용 정적 파일
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isDevelopment ? 0 : '1d',  // 개발: 캐시 안 함, 프로덕션: 1일
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // CSS/JS 파일은 더 긴 캐시
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', isDevelopment ? 'no-cache' : 'public, max-age=31536000, immutable');
    }
  }
}));

// 데이터 파일 (JSON만 허용)
app.use('/data', express.static(path.join(__dirname, 'data'), {
  setHeaders: (res, filePath) => {
    // JSON 파일만 허용
    if (!filePath.endsWith('.json')) {
      return res.status(403).send('허용되지 않는 파일 형식입니다.');
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// ============================================================================
// 라우트 정의
// ============================================================================

/**
 * 메인 페이지
 */
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

/**
 * 분석 페이지 (보안 강화)
 */
app.get('/assessments/:assessmentId', (req, res) => {
  try {
    const assessmentId = req.params.assessmentId;
    
    // ID 검증 (영문 소문자, 숫자, 하이픈만 허용)
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(assessmentId)) {
      return res.status(400).json({
        error: 'invalid_input',
        message: '유효하지 않은 분석 ID입니다.'
      });
    }

    // 백리스트 (허용된 페이지)
    const assessmentPages = {
      'mbti': 'assessments/mbti.html',
      'love-type': 'assessments/love-type.html',
      'career': 'assessments/career.html',
      'investment': 'assessments/investment.html'
    };

    const assessmentPath = assessmentPages[assessmentId];
    
    if (!assessmentPath) {
      return res.status(404).json({
        error: 'not_found',
        message: '분석을 찾을 수 없습니다.'
      });
    }

    // 경로 정규화 및 확인 (Path Traversal 방지)
    const fullPath = path.normalize(path.join(__dirname, 'public', assessmentPath));
    const publicDir = path.normalize(path.join(__dirname, 'public'));

    if (!fullPath.startsWith(publicDir)) {
      console.error('Path traversal attempt:', req.originalUrl);
      return res.status(403).json({
        error: 'access_denied',
        message: '접근이 거부되었습니다.'
      });
    }

    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('Error sending file:', fullPath, err);
        if (!res.headersSent) {
          res.status(404).json({
            error: 'not_found',
            message: '파일을 찾을 수 없습니다.'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error in assessments route:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'server_error',
        message: '서버 오류가 발생했습니다.'
      });
    }
  }
});

/**
 * 건강 체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * robots.txt
 */
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`
User-agent: *
Allow: /
Disallow: /api/
Disallow: /data/
Sitemap: https://${req.get('host')}/sitemap.xml
  `.trim());
});

/**
 * favicon.ico (404 방지)
 */
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ============================================================================
// 404 핸들러
// ============================================================================

app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  } else if (req.accepts('json')) {
    res.status(404).json({
      error: 'not_found',
      message: '요청한 리소스를 찾을 수 없습니다.',
      path: req.path
    });
  } else {
    res.status(404).send('404 - Not Found');
  }
});

// ============================================================================
// 에러 핸들러
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // 에러 응답
  const errorResponse = {
    error: 'server_error',
    message: isDevelopment ? err.message : '서버 오류가 발생했습니다.'
  };
  
  if (!isDevelopment) {
    delete errorResponse.error;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// ============================================================================
// 서버 시작
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🦞 PersonaHub Server`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
