import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>스키마 바이트</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const FONT_STACK = `Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, sans-serif`;

const GLOBAL_CSS = `
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: ${FONT_STACK};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overscroll-behavior: none;
}

/* RN-Web 기본 텍스트 클래스에만 Pretendard 적용 (이모지/아이콘 영향 X) */
.css-text-146c3p1, .css-textinput-11aywtz, .css-textHasAncestor-1jxf684 {
  font-family: ${FONT_STACK} !important;
  letter-spacing: -0.01em;
}
.r-fontFamily-1qd0xha {
  font-family: ${FONT_STACK} !important;
}

/* 모든 스크롤바 숨기기 */
*::-webkit-scrollbar { display: none; width: 0 !important; height: 0 !important; }
* { scrollbar-width: none; -ms-overflow-style: none; }
* { scroll-behavior: smooth; }

/* === 하단 탭바 viewport 하단 고정 === */
div:has(> [role="tablist"]) {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 100 !important;
  height: 76px !important;
  padding-top: 10px !important;
  padding-bottom: 14px !important;
  background: #ffffff !important;
  border-top: 1px solid #E5E7EB !important;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04) !important;
}

[role="tablist"] > div > a {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
  padding: 0 !important;
}

[role="tablist"] [role="tab"] div[dir="auto"] {
  white-space: nowrap !important;
  margin: 0 !important;
  line-height: 1.2 !important;
}
`;
