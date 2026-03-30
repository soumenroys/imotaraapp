import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const FEEDBACK_EMAIL = "info@imotara.com";

const resend = new Resend(process.env.RESEND_API_KEY);

type FeedbackType = "feedback" | "bug" | "crash";

type FeedbackBody = {
    type: FeedbackType;
    message: string;
    appVersion?: string;
    platform?: string;
    deviceModel?: string;
    osVersion?: string;
    userId?: string;
    stackTrace?: string;
};

function subjectFor(type: FeedbackType): string {
    if (type === "crash") return "[Imotara] Crash Report";
    if (type === "bug") return "[Imotara] Bug Report";
    return "[Imotara] User Feedback";
}

function htmlFor(body: FeedbackBody): string {
    const rows = [
        ["Type", body.type],
        ["App Version", body.appVersion ?? "—"],
        ["Platform", body.platform ?? "—"],
        ["Device", body.deviceModel ?? "—"],
        ["OS Version", body.osVersion ?? "—"],
        ["User ID", body.userId ?? "anonymous"],
    ]
        .map(
            ([k, v]) =>
                `<tr><td style="padding:4px 12px 4px 0;color:#94a3b8;font-size:13px;white-space:nowrap">${k}</td><td style="padding:4px 0;color:#f1f5f9;font-size:13px">${v}</td></tr>`
        )
        .join("");

    const stackSection = body.stackTrace
        ? `<h3 style="margin:20px 0 6px;font-size:13px;color:#94a3b8">Stack trace</h3>
           <pre style="background:#1e293b;padding:12px;border-radius:8px;font-size:11px;color:#f8fafc;overflow-x:auto;white-space:pre-wrap">${body.stackTrace}</pre>`
        : "";

    return `
<html>
<body style="background:#0f172a;color:#f1f5f9;font-family:sans-serif;padding:24px;margin:0">
  <h2 style="margin:0 0 16px;font-size:18px;color:#38bdf8">${subjectFor(body.type)}</h2>
  <table style="border-collapse:collapse;margin-bottom:20px">${rows}</table>
  <h3 style="margin:0 0 6px;font-size:13px;color:#94a3b8">Message</h3>
  <div style="background:#1e293b;padding:12px;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap">${body.message || "(no message)"}</div>
  ${stackSection}
  <p style="margin-top:24px;font-size:11px;color:#475569">Sent automatically by Imotara app · ${new Date().toUTCString()}</p>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as FeedbackBody;

        if (!body.type || !["feedback", "bug", "crash"].includes(body.type)) {
            return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
        }

        if (!body.message && body.type !== "crash") {
            return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
        }

        if (!process.env.RESEND_API_KEY) {
            // Graceful no-op in dev if key is not configured — don't break the app
            console.warn("[feedback] RESEND_API_KEY not set — email not sent");
            return NextResponse.json({ ok: true, dev: true });
        }

        await resend.emails.send({
            from: "Imotara App <noreply@imotara.com>",
            to: FEEDBACK_EMAIL,
            subject: subjectFor(body.type),
            html: htmlFor(body),
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[feedback] failed to send:", e?.message);
        return NextResponse.json({ ok: false, error: "Failed to send" }, { status: 500 });
    }
}
