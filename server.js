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
