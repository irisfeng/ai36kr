import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import {
  isPublicAddress,
  readImageResponse,
  resolvePublicImageTarget,
} from '../lib/safe-image.js';
import { fetchOgImage } from '../lib/ogimage.js';

test('image proxy rejects local, private, link-local, and reserved addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('93.184.216.34'), true);
  assert.equal(isPublicAddress('2606:2800:220:1:248:1893:25c8:1946'), true);
});

test('image proxy rejects credentials, nonstandard ports, and local hostnames', async () => {
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

  await assert.rejects(
    resolvePublicImageTarget('https://user:pass@example.com/a.png', { lookup: publicLookup }),
    /凭据/,
  );
  await assert.rejects(
    resolvePublicImageTarget('https://example.com:8443/a.png', { lookup: publicLookup }),
    /端口/,
  );
  await assert.rejects(
    resolvePublicImageTarget('http://localhost/a.png', { lookup: publicLookup }),
    /主机/,
  );
});

test('image proxy rejects a hostname if any DNS answer is non-public', async () => {
  const mixedLookup = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '127.0.0.1', family: 4 },
  ];

  await assert.rejects(
    resolvePublicImageTarget('https://example.com/a.png', { lookup: mixedLookup }),
    /非公网地址/,
  );
});

test('image proxy returns a pinned public destination', async () => {
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const target = await resolvePublicImageTarget('https://example.com/a.png', { lookup });

  assert.equal(target.url.href, 'https://example.com/a.png');
  assert.equal(target.hostname, 'example.com');
  assert.equal(target.address, '93.184.216.34');
  assert.equal(target.family, 4);
});

test('image proxy aborts while streaming when the byte cap is exceeded', async () => {
  const response = Readable.from([Buffer.alloc(4), Buffer.alloc(4)]);
  response.statusCode = 200;
  response.headers = { 'content-type': 'image/png' };
  let requestDestroyed = false;
  const request = { destroy: () => { requestDestroyed = true; } };

  await assert.rejects(
    readImageResponse(response, request, 6),
    (error) => error.code === 'TOO_LARGE' && error.status === 413,
  );
  assert.equal(requestDestroyed, true);
  assert.equal(response.destroyed, true);
});

test('og image lookup rejects private and local destinations before fetching', async () => {
  assert.equal(await fetchOgImage('http://127.0.0.1/private'), null);
  assert.equal(await fetchOgImage('http://169.254.169.254/latest/meta-data'), null);
  assert.equal(await fetchOgImage('http://localhost/admin'), null);
});
