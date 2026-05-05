/**
 * FlowStudio_re compat — `generateImage` facade.
 *
 * FlowStudio_re는 v1 fork로 추정되며 동일한 호출 시그니처를 사용합니다.
 * 본 facade는 v1 compat의 `generateImage`를 그대로 위임하면서 별도
 * import 경로(`@axle/pbc-image-engine/compat/flowstudio-re`)를 제공합니다.
 *
 * 차이가 발견되면 본 파일에서 분기 로직을 추가하고 위임 대신 자체 구현
 * 으로 전환하세요. 현재는 v1 동작을 100% 보존합니다.
 *
 * Drop-in 교체:
 *   - import { generateImage } from "@/lib/imageProvider";
 *   + import { generateImage } from "@axle/pbc-image-engine/compat/flowstudio-re";
 */

import {
  V1_DEFAULT_MODEL,
  generateImage as v1GenerateImage,
  type V1CompatRuntimeOptions,
} from "../flowstudio-v1/generateImage.js";
import type {
  ReGenerateImageOptions,
  ReGenerateImageResult,
} from "./types.js";

/**
 * FlowStudio_re의 기본 모델. v1과 동일한 `gemini-3-pro-image-preview`를
 * 사용합니다. 차이가 확인되면 본 상수를 분기하세요.
 */
export const RE_DEFAULT_MODEL = V1_DEFAULT_MODEL;

/**
 * Optional adapter injection. v1 compat의 옵션을 그대로 사용합니다.
 * 테스트에서 fake adapter를 주입하기 위한 진입점입니다.
 */
export type ReCompatRuntimeOptions = V1CompatRuntimeOptions;

/**
 * FlowStudio_re의 v1-호환 호출을 PBC로 위임합니다.
 *
 * v1과 동일한 동작:
 *   1. `options.env` → `IMAGE_PROVIDER` env var → "google" 기본 순으로
 *      provider env 해석.
 *   2. v1 옵션 객체를 canonical `GenerationRequest`로 변환.
 *   3. PBC `GenerationResult`를 v1 결과 형태(`durationMs`, no `cost`)로
 *      변환.
 */
export async function generateImage(
  options: ReGenerateImageOptions,
  runtime: ReCompatRuntimeOptions = {},
): Promise<ReGenerateImageResult> {
  return v1GenerateImage(options, runtime);
}
