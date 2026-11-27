import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getWibBoundaries() {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWib = new Date(Date.now() + wibOffsetMs);

  const startOfDayWib = new Date(
    Date.UTC(
      nowWib.getUTCFullYear(),
      nowWib.getUTCMonth(),
      nowWib.getUTCDate(),
      0,
      0,
      0,
    ) - wibOffsetMs,
  );

  const startOfMonthWib = new Date(
    Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), 1, 0, 0, 0) -
      wibOffsetMs,
  );

  const dayOfMonth = Math.max(1, nowWib.getUTCDate());

  return { startOfDayWib, startOfMonthWib, dayOfMonth };
}

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
      .select("id, user_id, nama, daya_nominal_w, ingest_key_hash")
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

    const measuredPower = Number(Number(p).toFixed(2));
    const parsedTs =
      typeof ts === "number" ? new Date(ts * 1000).toISOString() : ts;

    // Simpan bacaan sensor
    const { error: insertError } = await supabaseAdmin.from("readings").insert({
      device_id: device.id,
      ts: parsedTs,
      v,
      i,
      p: measuredPower,
      e_wh,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update status Online (last_seen_at)
    await supabaseAdmin
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    // Evaluasi Aturan Peringatan (Maks 1x per hari per jenis peringatan)
    if (device.user_id) {
      const { startOfDayWib, startOfMonthWib, dayOfMonth } = getWibBoundaries();

      const { data: rules } = await supabaseAdmin
        .from("user_thresholds")
        .select("*")
        .eq("user_id", device.user_id)
        .eq("aktif", true);

      if (rules && rules.length > 0) {
        for (const rule of rules) {
          // 1. Peringatan Durasi Alat Menyala Lama
          if (rule.tipe === "durasi_lama") {
            const nominalW = Number(device.daya_nominal_w) || 50;
            const thresholdWatt = Math.max(5, nominalW * 0.1);

            if (measuredPower >= thresholdWatt) {
              const { count: existingNotif } = await supabaseAdmin
                .from("notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", device.user_id)
                .eq("device_id", device.id)
                .eq("tipe", "durasi_lama")
                .gte("created_at", startOfDayWib.toISOString());

              if ((existingNotif || 0) === 0) {
                const { count: activeIntervals } = await supabaseAdmin
                  .from("readings")
                  .select("*", { count: "exact", head: true })
                  .eq("device_id", device.id)
                  .gte("ts", startOfDayWib.toISOString())
                  .gte("p", thresholdWatt);

                const activeHours = ((activeIntervals || 0) * 30) / 3600;
                if (activeHours >= Number(rule.ambang)) {
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

          // 2. Peringatan Estimasi Biaya Bulanan Melewati Ambang
          if (rule.tipe === "estimasi_biaya") {
            const { count: existingCostNotif } = await supabaseAdmin
              .from("notifications")
              .select("*", { count: "exact", head: true })
              .eq("user_id", device.user_id)
              .eq("tipe", "estimasi_biaya")
              .gte("created_at", startOfDayWib.toISOString());

            if ((existingCostNotif || 0) === 0) {
              const [{ data: profile }, { data: userDevices }] =
                await Promise.all([
                  supabaseAdmin
                    .from("profiles")
                    .select("tarif_per_kwh")
                    .eq("id", device.user_id)
                    .single(),
                  supabaseAdmin
                    .from("devices")
                    .select("id")
                    .eq("user_id", device.user_id),
                ]);

              const tarif = Number(profile?.tarif_per_kwh) || 1444.7;
              const devIds = (userDevices || []).map((d) => d.id);

              if (devIds.length > 0) {
                const { data: monthReads } = await supabaseAdmin
                  .from("readings")
                  .select("device_id, p, e_wh")
                  .in("device_id", devIds)
                  .gte("ts", startOfMonthWib.toISOString())
                  .order("ts", { ascending: true })
                  .limit(5000);

                let totalMonthKwh = 0;
                for (const dId of devIds) {
                  const dReads = (monthReads || []).filter(
                    (r) => r.device_id === dId,
                  );
                  if (dReads.length > 1) {
                    totalMonthKwh +=
                      Math.max(
                        0,
                        Number(dReads[dReads.length - 1].e_wh) -
                          Number(dReads[0].e_wh),
                      ) / 1000;
                  } else if (dReads.length === 1) {
                    totalMonthKwh += Math.max(
                      0.001,
                      Number(dReads[0].p) / 1000,
                    );
                  }
                }

                const currentCostRp = totalMonthKwh * tarif;
                const projectedMonthRp = Math.round(
                  (currentCostRp / dayOfMonth) * 30,
                );

                if (projectedMonthRp > Number(rule.ambang)) {
                  await supabaseAdmin.from("notifications").insert({
                    user_id: device.user_id,
                    device_id: device.id,
                    tipe: "estimasi_biaya",
                    judul: "Perkiraan biaya bulanan melewati batas aman",
                    isi: `Estimasi biaya perangkat terpantau mencapai Rp ${projectedMonthRp.toLocaleString("id-ID")} (batas aman: Rp ${Number(rule.ambang).toLocaleString("id-ID")}).`,
                    link: "/hemat",
                  });
                }
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
