import { z } from "zod";

export const orgChartMemberSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다").max(50),
  position: z.string().max(50).optional(),
});

export const orgChartDepartmentSchema = z.object({
  name: z.string().min(1, "부서명은 필수입니다").max(50),
  members: z.array(orgChartMemberSchema).max(50),
});

export const orgChartStructureSchema = z.object({
  companyName: z.string().min(1, "회사명은 필수입니다").max(100),
  ceo: orgChartMemberSchema,
  departments: z
    .array(orgChartDepartmentSchema)
    .min(1, "부서를 최소 1개 이상 추가해야 합니다")
    .max(20),
});

export type OrgChartStructureInput = z.infer<typeof orgChartStructureSchema>;
