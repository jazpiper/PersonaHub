/**
 * PersonaHub 시큐어 코딩 유틸리티
 */

const Security = {
  /**
   * HTML 엔티티 이스케이프 (XSS 방지)
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
   * URL 파라미터/ID 검증
   */
  validateId: (id) => {
    // 영문 소문자, 숫자, 하이픈만 허용
    const regex = /^[a-z0-9-]+$/;
    return regex.test(id);
  },

  /**
   * 안전한 HTML 요소 생성
   */
  safeCreateElement: (tag, className, text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) {
      // textContent 사용으로 XSS 방지
      element.textContent = text;
    }
    return element;
  },

  /**
   * JSON 데이터 스키마 검증 - 질문
   */
  validateQuestions: (questions) => {
    if (!Array.isArray(questions)) {
      console.error('Questions must be an array');
      return false;
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
   * JSON 데이터 스키마 검증 - 유형
   */
  validateTypes: (types) => {
    if (typeof types !== 'object' || types === null) {
      console.error('Types must be an object');
      return false;
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
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const data = await response.json();

      if (!validator(data)) {
        throw new Error(`Data validation failed for ${url}`);
      }

      return data;
    } catch (error) {
      console.error('Data load error:', error);
      throw error;
    }
  },

  /**
   * localStorage 데이터 검증
   */
  validateStorageData: (key, data) => {
    // 키 검증
    const keyRegex = /^[a-z0-9_-]+$/i;
    if (!keyRegex.test(key)) {
      console.error('Invalid storage key:', key);
      return false;
    }

    // 값 검증
    if (data === null || data === undefined) {
      return true;
    }

    // results 객체 검증
    if (key === 'results' && typeof data === 'object') {
      for (const [testId, result] of Object.entries(data)) {
        if (!result || typeof result !== 'object') {
          console.error(`Invalid result data for ${testId}`);
          return false;
        }

        if (!result.resultType || typeof result.resultType !== 'string') {
          console.error(`Missing resultType for ${testId}`);
          return false;
        }

        if (!result.completedAt) {
          console.error(`Missing completedAt for ${testId}`);
          return false;
        }
      }
    }

    return true;
  }
};

// 전역으로 내보내기
if (typeof window !== 'undefined') {
  window.Security = Security;
}

// Node.js 환경에서도 사용 가능하도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Security;
}
