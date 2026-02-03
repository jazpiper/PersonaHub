/**
 * PersonaHub Security Utilities
 * 보안 유틸리티 모음
 */

const Security = {
  /**
   * HTML 엔티티 이스케이프 - XSS 방지
   * @param {string} unsafe - 이스케이프할 문자열
   * @returns {string} 안전한 HTML 문자열
   */
  escapeHtml: (unsafe) => {
    if (typeof unsafe !== 'string') {
      return unsafe;
    }
    
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * HTML 속성 이스케이프
   * @param {string} unsafe - 이스케이프할 문자열
   * @returns {string} 안전한 속성 값
   */
  escapeAttribute: (unsafe) => {
    if (typeof unsafe !== 'string') {
      return unsafe;
    }
    
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  },

  /**
   * URL 파라미터 검증
   * 영문 소문자, 숫자, 하이픈만 허용
   * @param {string} id - 검증할 ID
   * @returns {boolean} 유효 여부
   */
  validateId: (id) => {
    const regex = /^[a-z0-9-]+$/;
    return regex.test(id);
  },

  /**
   * 스토리지 키 검증
   * 영문, 숫자, 언더스코어, 하이픈만 허용
   * @param {string} key - 검증할 키
   * @returns {boolean} 유효 여부
   */
  validateStorageKey: (key) => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(key);
  },

  /**
   * 안전한 HTML 요소 생성 (innerHTML 방지)
   * @param {string} tag - 태그 이름
   * @param {string} className - 클래스 이름
   * @param {string} content - 내용
   * @returns {HTMLElement} 생성된 요소
   */
  safeCreateElement: (tag, className, content = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) {
      element.textContent = content;
    }
    return element;
  },

  /**
   * 안전한 innerHTML 설정 (이스케이프 후)
   * @param {HTMLElement} element - 대상 요소
   * @param {string} html - 설정할 HTML
   */
  safeSetHTML: (element, html) => {
    element.innerHTML = Security.escapeHtml(html);
  },

  /**
   * 안전한 템플릿 렌더링
   * @param {Function} template - 템플릿 함수
   * @param {Object} data - 템플릿 데이터
   * @returns {string} 렌더링된 HTML
   */
  safeRender: (template, data) => {
    // 데이터의 모든 문자열 필드를 이스케이프
    const safeData = {};
    
    const escapeObject = (obj) => {
      if (typeof obj === 'string') {
        return Security.escapeHtml(obj);
      }
      
      if (Array.isArray(obj)) {
        return obj.map(escapeObject);
      }
      
      if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = escapeObject(value);
        }
        return result;
      }
      
      return obj;
    };
    
    for (const [key, value] of Object.entries(data)) {
      safeData[key] = escapeObject(value);
    }
    
    return template(safeData);
  },

  /**
   * CSP (Content Security Policy) 위반 감지
   */
  setupCSPViolationReporting: () => {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('securitypolicyviolation', (event) => {
        console.error('CSP Violation:', {
          blockedURI: event.blockedURI,
          documentURI: event.documentURI,
          violatedDirective: event.violatedDirective,
          effectiveDirective: event.effectiveDirective,
          originalPolicy: event.originalPolicy
        });
      });
    }
  },

  /**
   * 브라우저 보안 기능 확인
   * @returns {Object} 보안 기능 상태
   */
  checkSecurityFeatures: () => {
    return {
      secureContext: window.isSecureContext,
      https: window.location.protocol === 'https:',
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack === '1',
      privateBrowsing: false // 정확한 감지는 어려움
    };
  },

  /**
   * 안전한 URL 생성
   * @param {string} baseUrl - 기본 URL
   * @param {Object} params - 쿼리 파라미터
   * @returns {string} 안전한 URL
   */
  safeURL: (baseUrl, params = {}) => {
    const url = new URL(baseUrl);
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
    
    return url.toString();
  },

  /**
   * DOMPurify 대체 함수 (간단한 버전)
   * 실제 프로덕션에서는 DOMPurify 라이브러리 사용 권장
   * @param {string} dirty - 정화할 HTML
   * @returns {string} 정화된 HTML
   */
  sanitize: (dirty) => {
    // 가장 안전한 방법: 모든 HTML 태그 제거
    if (typeof dirty !== 'string') {
      return '';
    }
    
    // HTML 태그 제거
    const div = document.createElement('div');
    div.textContent = dirty;
    return div.innerHTML;
  },

  /**
   * 로컬 스토리지 래퍼 (보안 강화)
   */
  storage: {
    set: (key, value, maxSize = 1024 * 1024) => {
      try {
        // 키 검증
        if (!Security.validateStorageKey(key)) {
          console.error('Invalid storage key:', key);
          return false;
        }

        // 값 검증
        if (value === null || value === undefined) {
          return false;
        }

        // 크기 제한
        const serialized = JSON.stringify(value);
        if (serialized.length > maxSize) {
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
        if (!Security.validateStorageKey(key)) {
          return null;
        }

        const item = localStorage.getItem(`personaHub_${key}`);
        if (!item) return null;

        const parsed = JSON.parse(item);
        return parsed;
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },

    remove: (key) => {
      try {
        if (!Security.validateStorageKey(key)) {
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
  },

  /**
   * 결과 데이터 검증
   * @param {Object} result - 결과 객체
   * @returns {boolean} 유효 여부
   */
  validateResult: (result) => {
    if (!result || typeof result !== 'object') {
      return false;
    }

    // 필수 필드 확인
    const requiredFields = ['assessmentId', 'assessmentName', 'result', 'completedAt'];
    for (const field of requiredFields) {
      if (!result[field]) {
        return false;
      }
    }

    // assessmentId 검증
    if (!Security.validateId(result.assessmentId)) {
      return false;
    }

    // completedAt이 유효한 ISO 날짜인지 확인
    const date = new Date(result.completedAt);
    if (isNaN(date.getTime())) {
      return false;
    }

    return true;
  },

  /**
   * XSS 테스트 (개발용)
   * @param {string} input - 테스트할 입력
   * @returns {boolean} 취약 여부
   */
  testXSS: (input) => {
    const testStrings = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      'onerror="alert(\'XSS\')"',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>'
    ];

    return testStrings.some(testStr => input.includes(testStr));
  }
};

// 전역으로 내보내기
if (typeof window !== 'undefined') {
  window.Security = Security;
}

// Node.js 환경에서도 사용 가능
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Security;
}
