/**
 * PersonaHub 공통 유틸리티 라이브러리
 */

const PersonaHub = {
  // 유틸리티 함수들

  /**
   * URL 쿼리 파라미터 가져오기
   */
  getQueryParam: (name) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  },

  /**
   * 로컬 스토리지 저장소
   */
  storage: {
    set: (key, value) => {
      try {
        localStorage.setItem(`personaHub_${key}`, JSON.stringify(value));
      } catch (e) {
        console.error('localStorage 저장 실패:', e);
      }
    },
    get: (key) => {
      try {
        const item = localStorage.getItem(`personaHub_${key}`);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        console.error('JSON 파싱 실패:', e);
        return null;
      }
    },
    remove: (key) => {
      localStorage.removeItem(`personaHub_${key}`);
    },
    clear: () => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('personaHub_'))
        .forEach(key => localStorage.removeItem(key));
    }
  },

  /**
   * 배열 섞기
   */
  shuffle: (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  },

  /**
   * 랜덤 정수 생성
   */
  randomInt: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * 요소 보이기/숨기기
   */
  show: (element) => {
    element.classList.remove('hidden');
  },

  hide: (element) => {
    element.classList.add('hidden');
  },

  /**
   * 스크롤 맨 위로
   */
  scrollToTop: () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * 디바운스 함수 (연속 이벤트 방지)
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * 텍스트 길이 제한
   */
  truncate: (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * 날짜 포맷팅
   */
  formatDate: (date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  },

  /**
   * 숫자 포맷팅 (1,000)
   */
  formatNumber: (num) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  },

  /**
   * 백분율 계산
   */
  percentage: (part, total) => {
    return Math.round((part / total) * 100);
  },

  /**
   * 다크 모드 감지
   */
  isDarkMode: () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  /**
   * 모바일 감지
   */
  isMobile: () => {
    return window.innerWidth < 768;
  },

  /**
   * 이벤트 리스너 추가 (단순화)
   */
  on: (element, event, handler) => {
    element.addEventListener(event, handler);
  },

  /**
   * 요소 생성 헬퍼
   */
  createElement: (tag, className, text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text; // ✅ XSS 방지 (textContent 사용)
    return element;
  },

  /**
   * 결과 저장
   */
  saveResult: (testId, result) => {
    const results = PersonaHub.storage.get('results') || {};
    results[testId] = {
      ...result,
      completedAt: new Date().toISOString()
    };
    PersonaHub.storage.set('results', results);
  },

  /**
   * 결과 불러오기
   */
  getResult: (testId) => {
    const results = PersonaHub.storage.get('results') || {};
    return results[testId] || null;
  },

  /**
   * 모든 결과 불러오기
   */
  getAllResults: () => {
    return PersonaHub.storage.get('results') || {};
  },

  /**
   * 유저 통계 계산
   */
  getUserStats: () => {
    const results = PersonaHub.getAllResults();
    const totalTests = Object.keys(results).length;
    const completedDates = Object.values(results)
      .map(r => r.completedAt)
      .sort((a, b) => new Date(b) - new Date(a));

    return {
      totalTests,
      lastTest: completedDates[0] || null,
      testsByType: {}
    };
  },

  /**
   * 공유 기능
   */
  share: {
    // 카카오톡 공유
    kakao: (text, url) => {
      const shareUrl = `https://kakaotalk.sharer?url=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
    },

    // 페이스북 공유
    facebook: (url) => {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
    },

    // 트위터 공유
    twitter: (text, url) => {
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
    },

    // 클립보드 복사
    copy: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        alert('클립보드에 복사되었습니다!');
        return true;
      } catch (err) {
        console.error('클립보드 복사 실패:', err);
        return false;
      }
    }
  }
};

// 전역으로 내보내기
if (typeof window !== 'undefined') {
  window.PersonaHub = PersonaHub;
}

// Node.js 환경에서도 사용 가능하도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PersonaHub;
}
