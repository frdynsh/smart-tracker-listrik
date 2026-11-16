import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key tidak ditemukan" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { device_id, ts, v, i, p, e_wh } = body;

    if (
      !device_id ||
      !ts ||
      v === undefined ||
      i === undefined ||
      p === undefined ||
      e_wh === undefined
    ) {
      return NextResponse.json(
        { error: "Payload tidak lengkap" },
        { status: 400 },
      );
    }

    // Filter Anti-Glitch PZEM-004T
    if (v < 150 || v > 300 || i < 0 || i > 15 || p < 0 || p > 3500) {
      return NextResponse.json(
        { error: "Nilai sensor di luar batas wajar" },
        { status: 422 },
      );
    }

    // Validasi Perangkat & Kunci Alat
    const { data: device, error: devError } = await supabaseAdmin
      .from("devices")
      .select(
        "id, user_id, nama, daya_nominal_w, ingest_key_hash, faktor_koreksi",
      )
      .eq("id", device_id)
      .single();

    if (devError || !device) {
      return NextResponse.json(
        { error: "Perangkat tidak terdaftar" },
        { status: 404 },
      );
    }

    const incomingHash = crypto
      .createHash("sha256")
      .update(apiKey)
      .digest("hex");
    if (incomingHash !== device.ingest_key_hash) {
      return NextResponse.json(
        { error: "Kunci alat tidak valid" },
        { status: 403 },
      );
    }

    const correctedPower = Number((p * device.faktor_koreksi).toFixed(2));
    const parsedTs =
      typeof ts === "number" ? new Date(ts * 1000).toISOString() : ts;

    // Simpan bacaan sensor (anti-duplikat)
    const { error: insertError } = await supabaseAdmin.from("readings").upsert(
      {
        device_id: device.id,
        ts: parsedTs,
        v,
        i,
        p: correctedPower,
        e_wh,
        is_simulated: false,
      },
      { onConflict: "device_id,ts", ignoreDuplicates: true },
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update status Online
    await supabaseAdmin
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    // Evaluasi Aturan Peringatan (Maks 1x per hari)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: rules } = await supabaseAdmin
      .from("alert_rules")
      .select("*")
      .eq("user_id", device.user_id)
      .eq("aktif", true);

    if (rules) {
      for (const rule of rules) {
        if (rule.tipe === "durasi_lama") {
          const thresholdWatt = Math.max(5, device.daya_nominal_w * 0.1);
          if (correctedPower >= thresholdWatt) {
            const { count: existingNotif } = await supabaseAdmin
              .from("notifications")
              .select("*", { count: "exact", head: true })
              .eq("user_id", device.user_id)
              .eq("device_id", device.id)
              .eq("tipe", "durasi_lama")
              .gte("created_at", todayStart.toISOString());

            if ((existingNotif || 0) === 0) {
              const { count: activeIntervals } = await supabaseAdmin
                .from("readings")
                .select("*", { count: "exact", head: true })
                .eq("device_id", device.id)
                .gte("ts", todayStart.toISOString())
                .gte("p", thresholdWatt);

              const activeHours = ((activeIntervals || 0) * 30) / 3600;
              if (activeHours >= rule.ambang) {
                await supabaseAdmin.from("notifications").insert({
                  user_id: device.user_id,
                  device_id: device.id,
                  tipe: "durasi_lama",
                  judul: `${device.nama} menyala terlalu lama`,
                  isi: `${device.nama} telah menyala sekitar ${activeHours.toFixed(1)} jam hari ini (batas: ${rule.ambang} jam).`,
                  link: "/cek",
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json(
      { status: "ok", message: "Data tersimpan" },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Format request tidak valid" },
      { status: 400 },
    );
  }
}
