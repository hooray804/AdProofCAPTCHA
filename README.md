# AdProofCAPTCHA

AdProofCAPTCHA는 제로 트러스트(Zero-Trust) 환경을 위한 Proof-of-Ad(광고 기반 작업 증명) 및 안티-봇 프레임워크입니다. 
사용자에게 광고 배너 위의 시각적 암호 퍼즐을 풀게 하고, 백그라운드에서 작업 증명(PoW) 해시를 연산하여 사람과 봇을 구분함과 동시에 광고 차단기(AdBlock)를 우회/무력화합니다.

## Architecture
- `packages/server`: 난수화된 비트맵(BMP) 생성 및 세션/PoW 무결성 검증 엔진 (프레임워크 독립적)
- `packages/client`: Shadow DOM 캡슐화, 크로스 오리진 캔버스 해싱 및 브라우저 환경 변조 감지 SDK
- `examples`: Express.js 및 Vanilla HTML 연동 예제

## Quick Start
자세한 연동 방법은 `examples` 폴더의 코드를 참조하세요.
