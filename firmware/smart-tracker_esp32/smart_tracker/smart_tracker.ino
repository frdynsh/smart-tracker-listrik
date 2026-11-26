#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFiManager.h>      // Library: WiFiManager by tzapu
#include <PZEM004Tv30.h>      // Library: PZEM004Tv30 by mandulaj
#include <time.h>

// ==========================================
// 1. IDENTITAS UNIT HARDWARE (PRE-PROVISIONED)
// ==========================================
const char* CLAIM_CODE = "STL-1001";
const char* serverUrl  = "https://smart-tracker-listrik.vercel.app/api/ingest";

// Kredensial sesuai baris STL-1001 di tabel devices Supabase
const char* deviceId   = "1e7ec3f5-17e7-4d76-8452-72ae79f19d32";
const char* apiKey     = "stl_esp32_unit01_rahasia991";

// ==========================================
// 2. PENGATURAN SENSOR, PIN & INTERVAL
// ==========================================
#define PZEM_RX_PIN    16
#define PZEM_TX_PIN    17
#define WIFI_RESET_PIN 0      // Tombol BOOT bawaan ESP32 (tahan 5 detik untuk reset Wi-Fi)

PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
WiFiManager wm;

const unsigned long SEND_INTERVAL = 15000; // Kirim data tiap 15 detik
unsigned long lastSendTime = 0;
bool ntpSynced = false;

// Buffer cadangan di RAM (maksimal 20 bacaan jika Wi-Fi terputus sementara)
struct ReadingData {
  unsigned long ts;
  float v;
  float i;
  float p;
  float e_wh;
};
const int MAX_BUFFER = 20;
ReadingData offlineBuffer[MAX_BUFFER];
int bufferCount = 0;

void syncNtpTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Sinkronisasi waktu NTP");
  time_t now = time(nullptr);
  int retry = 0;
  while (now < 1700000000 && retry < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    retry++;
  }
  if (now >= 1700000000) {
    ntpSynced = true;
    Serial.println("\nWaktu NTP sinkron!");
  } else {
    Serial.println("\n[INFO] NTP belum siap, akan dicoba ulang di loop.");
  }
}

void checkResetButton() {
  if (digitalRead(WIFI_RESET_PIN) == LOW) {
    unsigned long pressStart = millis();
    while (digitalRead(WIFI_RESET_PIN) == LOW) {
      if (millis() - pressStart >= 5000) {
        Serial.println("\n[RESET] Tombol BOOT ditahan 5 detik. Menghapus pengaturan Wi-Fi...");
        wm.resetSettings();
        delay(1000);
        ESP.restart();
      }
      delay(100);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(WIFI_RESET_PIN, INPUT_PULLUP);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.printf(" SmartListrik IoT Node | Kode Stiker: %s\n", CLAIM_CODE);
  Serial.println("==========================================");

  // Mode STA dengan daya pancar hemat agar tidak memicu brownout reset saat memakai daya USB
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_11dBm);

  String apName = "SmartListrik-" + String(CLAIM_CODE);
  wm.setConfigPortalBlocking(false); // Non-blocking: mencegah WDT reset saat portal menunggu HP
  wm.setConnectTimeout(15);          // Coba Wi-Fi tersimpan maks 15 detik, lalu buka portal

  Serial.println("Mencoba Wi-Fi tersimpan atau membuka portal: " + apName);
  if (wm.autoConnect(apName.c_str())) {
    Serial.println("Wi-Fi Terhubung! IP Lokal: " + WiFi.localIP().toString());
    syncNtpTime();
  } else {
    Serial.println("Portal Wi-Fi aktif! Hubungkan HP ke '" + apName + "' lalu buka 192.168.4.1");
  }
}

bool sendToServer(ReadingData data) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, serverUrl)) {
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", apiKey);

  String payload = "{";
  payload += "\"device_id\":\"" + String(deviceId) + "\",";
  payload += "\"ts\":" + String(data.ts) + ",";
  payload += "\"v\":" + String(data.v, 2) + ",";
  payload += "\"i\":" + String(data.i, 3) + ",";
  payload += "\"p\":" + String(data.p, 2) + ",";
  payload += "\"e_wh\":" + String(data.e_wh, 2);
  payload += "}";

  Serial.println("[" + String(CLAIM_CODE) + "] Mengirim payload: " + payload);
  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("Respons Server [%d]: %s\n", httpResponseCode, response.c_str());
    http.end();
    return (httpResponseCode == 200 || httpResponseCode == 201);
  } else {
    Serial.printf("Gagal kirim HTTP, error: %s\n", http.errorToString(httpResponseCode).c_str());
    http.end();
    return false;
  }
}

void loop() {
  // Wajib dipanggil di loop agar portal konfigurasi 192.168.4.1 berjalan stabil tanpa reset
  wm.process();
  checkResetButton();

  // Tunggu sampai HP selesai mengatur Wi-Fi lewat portal 192.168.4.1
  if (WiFi.status() != WL_CONNECTED) {
    delay(10);
    return;
  }

  // Begitu Wi-Fi baru terhubung dari portal, langsung sinkronkan NTP
  if (!ntpSynced) {
    Serial.println("\nWi-Fi Terhubung! IP Lokal: " + WiFi.localIP().toString());
    syncNtpTime();
    if (!ntpSynced) return;
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL || lastSendTime == 0) {
    lastSendTime = currentMillis;

    time_t now = time(nullptr);
    if (now < 1700000000) {
      ntpSynced = false;
      return;
    }

    float voltage = pzem.voltage();
    float current = pzem.current();
    float power   = pzem.power();
    float energy  = pzem.energy();

    if (isnan(voltage) || isnan(current) || isnan(power) || isnan(energy)) {
      Serial.println("[PERINGATAN] Sensor PZEM tidak membaca tegangan AC! Pastikan steker alat tercolok ke stopkontak.");
      return;
    }

    ReadingData currentReading;
    currentReading.ts   = (unsigned long)now;
    currentReading.v    = voltage;
    currentReading.i    = current;
    currentReading.p    = power;
    currentReading.e_wh = energy * 1000.0;

    while (bufferCount > 0 && WiFi.status() == WL_CONNECTED) {
      Serial.println("Mengirim ulang data dari buffer offline...");
      if (sendToServer(offlineBuffer[0])) {
        for (int j = 0; j < bufferCount - 1; j++) {
          offlineBuffer[j] = offlineBuffer[j + 1];
        }
        bufferCount--;
      } else {
        break;
      }
    }

    if (!sendToServer(currentReading)) {
      if (bufferCount < MAX_BUFFER) {
        offlineBuffer[bufferCount++] = currentReading;
        Serial.printf("Server gangguan. Data disimpan ke buffer (%d/%d).\n", bufferCount, MAX_BUFFER);
      }
    }
  }
}