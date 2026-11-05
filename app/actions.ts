"use server";

import { revalidatePath } from "next/cache";
import type { AppStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, signIn, signOut } from "@/lib/auth";
import { runIngest } from "@/lib/ingest";

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/matches" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}

export async function saveCriteria(form: FormData) {
  const user = await requireUser();
  const data = {
    titles: list(form.get("titles")),
    locations: list(form.get("locations")),
    countries: form.getAll("countries").map(String),
    workTypes: form.getAll("workTypes").map(String),
    salaryMin: int(form.get("salaryMin")),
    salaryMax: int(form.get("salaryMax")),
    keywords: list(form.get("keywords")),
    excludeKeywords: list(form.get("excludeKeywords")),
    workRights: String(form.get("workRights") ?? "").trim() || null,
  };
  await prisma.criteria.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  revalidatePath("/profile");
}

export async function refreshNow() {
  const user = await requireUser();
  await runIngest({ userIds: [user.id] });
  revalidatePath("/matches");
}

export async function markApplied(form: FormData) {
  const user = await requireUser();
  const jobId = String(form.get("jobId"));
  const status = (String(form.get("status") || "APPLIED") as AppStatus);
  const reason = String(form.get("reason") ?? "").trim() || "No reason recorded";
  const followUpDays = int(form.get("followUpDays"));
  const now = new Date();
  const data = {
    status,
    reason,
    appliedAt: status === "APPLIED" ? now : null,
    followUpAt: followUpDays ? new Date(now.getTime() + followUpDays * 86_400_000) : null,
  };
  await prisma.application.upsert({
    where: { userId_jobId: { userId: user.id, jobId } },
    create: { userId: user.id, jobId, ...data },
    update: data,
  });
  revalidatePath("/matches");
  revalidatePath("/tracker");
}

export async function dismissMatch(form: FormData) {
  const user = await requireUser();
  await prisma.match.updateMany({
    where: { id: String(form.get("matchId")), userId: user.id },
    data: { dismissed: true },
  });
  revalidatePath("/matches");
}

export async function updateApplication(form: FormData) {
  const user = await requireUser();
  const status = String(form.get("status")) as AppStatus;
  const followUp = String(form.get("followUpAt") ?? "");
  const existing = await prisma.application.findFirst({
    where: { id: String(form.get("id")), userId: user.id },
  });
  if (!existing) return;
  await prisma.application.update({
    where: { id: existing.id },
    data: {
      status,
      notes: String(form.get("notes") ?? "").trim() || null,
      followUpAt: followUp ? new Date(followUp) : null,
      appliedAt: status === "APPLIED" && !existing.appliedAt ? new Date() : existing.appliedAt,
    },
  });
  revalidatePath("/tracker");
}
