import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(16, "유효하지 않은 토큰입니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
});

const TOKEN_PREFIX = "pwreset:";

export async function POST(req: NextRequest) {
  let token: string;
  let password: string;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    ({ token, password } = parsed.data);
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const record = await prisma.verificationToken.findUnique({ where: { token } });

    if (!record || !record.identifier.startsWith(TOKEN_PREFIX)) {
      return NextResponse.json(
        { message: "유효하지 않거나 만료된 재설정 링크입니다. 다시 요청해 주세요." },
        { status: 400 },
      );
    }

    if (record.expires.getTime() < Date.now()) {
      // 만료 토큰은 즉시 청소
      await prisma.verificationToken
        .delete({ where: { token } })
        .catch(() => undefined);
      return NextResponse.json(
        { message: "재설정 링크가 만료되었습니다. 다시 요청해 주세요." },
        { status: 400 },
      );
    }

    const email = record.identifier.slice(TOKEN_PREFIX.length);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // 사용자 삭제 등 비정상 상태
      await prisma.verificationToken
        .delete({ where: { token } })
        .catch(() => undefined);
      return NextResponse.json(
        { message: "유효하지 않은 링크입니다. 다시 요청해 주세요." },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      }),
      // 1회성 — 해당 토큰 삭제
      prisma.verificationToken.delete({ where: { token } }),
      // 같은 사용자의 다른 reset 토큰도 무효화
      prisma.verificationToken.deleteMany({
        where: { identifier: record.identifier },
      }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[reset-password] error", error);
    return NextResponse.json(
      { message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
