// ADR-004 check (passed 2026-10-09). Run after `pnpm install` in apps/api: node infra/checks/garage-check.mjs with S3_* + GARAGE_BUCKET env.
// Reads S3 creds from env; never prints secrets.
import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'garage',
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
const Bucket = process.env.GARAGE_BUCKET;
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);

// 1. presigned PUT with signed Content-Type + Content-Length
const key = `tmp/spike/${Date.now()}.png`;
const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: key, ContentType: 'image/png', ContentLength: 1000 }), {
  expiresIn: 300,
  signableHeaders: new Set(['content-type', 'content-length']),
});
const put = (body, type) => fetch(url, { method: 'PUT', body, headers: { 'content-type': type, 'content-length': String(body.length) } });
const okRes = await put(new Uint8Array(1000), 'image/png');
check('PUT with declared size + type accepted', okRes.status === 200, `HTTP ${okRes.status}`);
const big = await put(new Uint8Array(2000), 'image/png');
check('PUT larger than declared size rejected', big.status === 403, `HTTP ${big.status}`);
const wrongType = await put(new Uint8Array(1000), 'image/gif');
check('PUT with different content-type rejected', wrongType.status === 403, `HTTP ${wrongType.status}`);

// 2. lifecycle expiry on tmp/
try {
  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket,
    LifecycleConfiguration: { Rules: [{ ID: 'expire-tmp', Status: 'Enabled', Filter: { Prefix: 'tmp/' }, Expiration: { Days: 1 } }] },
  }));
  const lc = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket }));
  const rule = lc.Rules?.find((r) => r.ID === 'expire-tmp');
  check('lifecycle rule tmp/ → 1 day stored', rule?.Expiration?.Days === 1 && rule?.Filter?.Prefix === 'tmp/');
} catch (e) {
  check('lifecycle rule tmp/ → 1 day stored', false, e.name);
}

// 3. hour-bucketed signed GET is stable within the hour and works
const hour = new Date(); hour.setUTCMinutes(0, 0, 0);
const sign = () => getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 7200, signingDate: hour });
const [g1, g2] = [await sign(), await sign()];
check('signed GET identical within the same hour', g1 === g2);
const got = await fetch(g1);
check('signed GET downloads the object', got.status === 200 && (await got.arrayBuffer()).byteLength === 1000, `HTTP ${got.status}`);

await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
