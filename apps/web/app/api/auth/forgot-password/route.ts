import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@axle/db";
import { sendEmail, passwordResetEmail } from "@axle/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
});

const TOKEN_TTL_MINUTES = 30;
const TOKEN_PREFIX = "pwreset:";

// User enumeration 방지를 위해 성공/실패 응답을 동일하게 유지합니다.
const GENERIC_OK = { ok: true } as const;

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    email = parsed.data.email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // 등록되지 않은 이메일이거나 비밀번호 계정이 없으면(OAuth-only) 조용히 성공 반환.
    // 이렇게 해야 공격자가 어떤 이메일이 가입되어 있는지 알 수 없습니다.
    if (!user || !user.password) {
      return NextResponse.json(GENERIC_OK, { status: 200 });
    }

    const identifier = `${TOKEN_PREFIX}${email}`;
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

    // 이전에 남은 토큰은 정리 — 최신 1개만 유효.
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: { identifier, token, expires },
    });

    const origin =
      req.headers.get("origin") ??
      process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      "https://axleai.io";
    const resetUrl = `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;

    const html = passwordResetEmail({
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MINUTES,
      userName: user.name ?? undefined,
    });

    await sendEmail({
      to: email,
      subject: "[AXLE] 비밀번호 재설정 안내",
      html,
    });

    return NextResponse.json(GENERIC_OK, { status: 200 });
  } catch (error) {
    console.error("[forgot-password] error", error);
    // 외부에는 여전히 동일 응답 — enumeration 방지 최우선.
    return NextResponse.json(GENERIC_OK, { status: 200 });
  }
}
