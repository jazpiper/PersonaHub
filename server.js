const express = require('express');
const helmet = require('helmet');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 보안 헤더 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://pagead2.googlesyndication.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["https://pagead2.googlesyndication.com"]
        }
    }
}));

// 추가 보안 헤더
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 분석 페이지
app.get('/assessments/:assessmentId', (req, res) => {
    const assessmentId = req.params.assessmentId;
    const assessmentPages = {
        'mbti': 'assessments/mbti.html',
        'love-type': 'assessments/love-type.html',
        'career': 'assessments/career.html',
        'investment': 'assessments/investment.html'
        // 다른 분석 페이지들도 여기에 추가
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
