/**
 * PersonaHub 테스트 엔진
 * 모든 테스트에 공통으로 사용하는 테스트 엔진
 */

class TestEngine {
  constructor(config) {
    this.config = {
      testId: '',
      testName: '',
      questions: [],
      results: {},
      minQuestions: 5,
      skipQuestionThreshold: 0.3, // 30% 이상 스킵하면 불완료 처리
      ...config
    };
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.skippedCount = 0;
    this.progress = 0;
  }

  /**
   * 테스트 시작
   */
  start() {
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.skippedCount = 0;
    this.progress = 0;
    this.onTestStart && this.onTestStart();
  }

  /**
   * 현재 질문 가져오기
   */
  getCurrentQuestion() {
    return this.config.questions[this.currentQuestionIndex];
  }

  /**
   * 다음 질문으로 이동
   */
  nextQuestion() {
    if (this.currentQuestionIndex < this.config.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
      return true;
    }
    return false;
  }

  /**
   * 이전 질문으로 이동
   */
  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.updateProgress();
      return true;
    }
    return false;
  }

  /**
   * 답변 저장
   */
  saveAnswer(questionIndex, answerValue) {
    this.answers[questionIndex] = {
      questionIndex,
      answerValue,
      skipped: answerValue === null || answerValue === undefined
    };

    if (answerValue === null || answerValue === undefined) {
      this.skippedCount++;
    }
  }

  /**
   * 답변 업데이트
   */
  updateAnswer(questionIndex, answerValue) {
    this.answers[questionIndex] = {
      questionIndex,
      answerValue,
      skipped: answerValue === null || answerValue === undefined
    };
  }

  /**
   * 답변 스킵
   */
  skipQuestion(questionIndex) {
    this.answers[questionIndex] = {
      questionIndex,
      answerValue: null,
      skipped: true
    };
    this.skippedCount++;
  }

  /**
   * 진행률 업데이트
   */
  updateProgress() {
    this.progress = ((this.currentQuestionIndex + 1) / this.config.questions.length) * 100;
  }

  /**
   * 현재 진행률 가져오기
   */
  getProgress() {
    return this.progress;
  }

  /**
   * 답변 완료 여부 체크
   */
  isComplete() {
    const answeredCount = this.answers.filter(a => a && !a.skipped).length;
    const skipRatio = this.skippedCount / this.config.questions.length;

    // 최소 질문 수 미달
    if (answeredCount < this.config.minQuestions) {
      return false;
    }

    // 스킵 비율이 너무 높음
    if (skipRatio > this.config.skipQuestionThreshold) {
      return false;
    }

    return true;
  }

  /**
   * 점수 계산
   */
  calculateScores() {
    const scores = {};

    // 기본 점수 계산 (각 유형별 점수)
    this.answers.forEach(answer => {
      if (!answer || answer.skipped) return;

      const question = this.config.questions[answer.questionIndex];
      const scoringRule = question.scoring || {};

      // 질문의 점수 규칙에 따라 점수 부여
      Object.keys(scoringRule).forEach(type => {
        if (!scores[type]) scores[type] = 0;
        scores[type] += scoringRule[type][answer.answerValue] || 0;
      });
    });

    return scores;
  }

  /**
   * 결과 결정 (가장 높은 점수의 유형)
   */
  determineResult(scores) {
    let maxScore = -Infinity;
    let resultType = null;

    Object.keys(scores).forEach(type => {
      if (scores[type] > maxScore) {
        maxScore = scores[type];
        resultType = type;
      }
    });

    return {
      type: resultType,
      scores,
      confidence: this.calculateConfidence(scores, resultType)
    };
  }

  /**
   * 신뢰도 계산 (1위와 2위 점수 차이)
   */
  calculateConfidence(scores, resultType) {
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    if (sortedScores.length < 2) return 100;

    const diff = sortedScores[0] - sortedScores[1];
    const maxPossible = Math.max(...sortedScores);

    return Math.round((diff / maxPossible) * 100);
  }

  /**
   * 테스트 완료 및 결과 계산
   */
  complete() {
    if (!this.isComplete()) {
      throw new Error('테스트가 완료되지 않았습니다.');
    }

    const scores = this.calculateScores();
    const result = this.determineResult(scores);

    const finalResult = {
      testId: this.config.testId,
      testName: this.config.testName,
      answers: this.answers,
      scores: scores,
      resultType: result.type,
      confidence: result.confidence,
      completedAt: new Date().toISOString()
    };

    this.onTestComplete && this.onTestComplete(finalResult);
    return finalResult;
  }

  /**
   * 질문 섞기 (랜덤 순서)
   */
  shuffleQuestions() {
    this.config.questions = this.shuffleArray(this.config.questions);
    this.currentQuestionIndex = 0;
  }

  /**
   * 배열 섞기 (피셔-예이츠)
   */
  shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * 통계 데이터 수집
   */
  getStats() {
    const answeredCount = this.answers.filter(a => a && !a.skipped).length;
    const answeredQuestions = this.answers
      .filter(a => a && !a.skipped)
      .map(a => a.questionIndex);

    return {
      totalQuestions: this.config.questions.length,
      answeredCount,
      skippedCount: this.skippedCount,
      skipRatio: this.skippedCount / this.config.questions.length,
      answeredQuestions,
      completionRate: (answeredCount / this.config.questions.length) * 100
    };
  }

  /**
   * 이벤트 핸들러 등록
   */
  on(event, handler) {
    switch (event) {
      case 'start':
        this.onTestStart = handler;
        break;
      case 'complete':
        this.onTestComplete = handler;
        break;
      case 'progress':
        this.onProgress = handler;
        break;
      default:
        console.warn(`알 수 없는 이벤트: ${event}`);
    }
  }

  /**
   * 결과 디스크립션 가져오기
   */
  getResultDescription(resultType) {
    return this.config.results[resultType] || '결과를 찾을 수 없습니다.';
  }

  /**
   * 결과 공유 텍스트 생성
   */
  generateShareText(resultType) {
    const description = this.getResultDescription(resultType);
    return `내 ${this.config.testName} 결과는 "${resultType}"입니다! ${description} #${this.config.testId} #테스트결과`;
  }

  /**
   * 데이터 내보내기 (분석용)
   */
  exportData() {
    return {
      config: this.config,
      answers: this.answers,
      stats: this.getStats(),
      result: this.isComplete() ? this.calculateScores() : null
    };
  }
}

// Node.js 환경에서도 사용 가능하도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestEngine;
}

if (typeof window !== 'undefined') {
  window.TestEngine = TestEngine;
}
