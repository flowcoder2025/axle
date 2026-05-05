/**
 * FlowStudio_re → PBC compatibility surface — types.
 *
 * FlowStudio_re는 FlowStudio v1의 fork로 추정되며, 동일한
 * `lib/imageProvider/` 공개 형태를 사용합니다 (spec: pbc-image-engine.md §2).
 * 따라서 본 모듈은 v1 compat의 타입을 그대로 재사용하면서 RE 프로젝트의
 * 식별자(`Re*` 접두)를 노출하여 import 경로 차이를 명확히 합니다.
 *
 * v1과 차이가 발견되면 본 파일에서 별도 타입으로 분기합니다. 현재는
 * v1과 100% 동일한 시맨틱을 보존합니다.
 *
 * 마이그레이션 플레이북: docs/specs/meta-platform/migrations/flowstudio-re-to-pbc.md
 */

import type {
  V1GenerateImageOptions,
  V1GenerateImageResult,
  V1GeneratedImage,
  V1ProviderEnv,
} from "../flowstudio-v1/types.js";

export type ReProviderEnv = V1ProviderEnv;
export type ReGenerateImageOptions = V1GenerateImageOptions;
export type ReGeneratedImage = V1GeneratedImage;
export type ReGenerateImageResult = V1GenerateImageResult;
