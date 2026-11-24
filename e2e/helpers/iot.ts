import crypto from 'node:crypto';

export interface SendIotEventOptions {
  readonly backendUrl?: string;
  readonly deviceUid?: string;
  readonly status: 'FAULT' | 'RESOLVED' | 'NORMAL';
  readonly seq?: number;
  readonly secret?: string;
}

export interface IotEventResponse {
  readonly success: boolean;
  readonly event?: string;
  readonly status?: string;
  readonly clusterId?: string;
  readonly activeClusterIdResolved?: string;
  readonly previousClusterId?: string;
  readonly deviceId?: string;
  readonly trackingCode?: string;
  readonly message?: string;
  readonly duplicate?: boolean;
}

export async function sendIotEvent(options: SendIotEventOptions): Promise<IotEventResponse> {
  const backendUrl =
    options.backendUrl || process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:3005';
  const deviceUid = options.deviceUid || 'UNO_Q_01';
  const seq = options.seq || Math.floor(Math.random() * 10000) + 1;
  const secret = options.secret || process.env.DEVICE_HMAC_SECRET || 'jansetu-iot-dev-secret';
  const idempotencyKey = `${deviceUid}-${seq}-${options.status}-${Date.now()}`;

  const body = {
    device_id: deviceUid,
    status: options.status,
    type: 'STREETLIGHT',
    idempotency_key: idempotencyKey,
    seq,
    uptime_ms: 120000,
    ldr_raw: options.status === 'FAULT' ? 120 : 850,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const bodyStr = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${bodyStr}`)
    .digest('hex');

  const res = await fetch(`${backendUrl}/api/v1/iot/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceUid,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`IoT event failed with HTTP ${res.status}: ${errorText}`);
  }

  return (await res.json()) as IotEventResponse;
}
