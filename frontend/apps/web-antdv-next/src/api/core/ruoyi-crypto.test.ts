import CryptoJS from 'crypto-js';
import { describe, expect, it } from 'vitest';

import {
  buildEncryptHeader,
  decryptBase64,
  decryptByAes,
  decryptByRsa,
  encryptBase64,
  encryptByAes,
  encryptByRsa,
  generateAesKey,
} from './ruoyi-crypto';

/**
 * 后端 `api-decrypt` 是**两对独立密钥**（platform/aoyou-admin/src/main/resources/application.yml）：
 *
 * - 请求方向：前端用 `VITE_APP_RSA_PUBLIC_KEY`(A) 加密，后端用 `api-decrypt.privateKey`(A') 解密；
 * - 响应方向：后端用 `api-decrypt.publicKey`(B) 加密，前端用 `VITE_APP_RSA_PRIVATE_KEY`(B') 解密。
 *
 * 因此前端持有的公钥与私钥**不是一对**，不能互相加解密——这也是下面分两组测试的原因。
 */
/** A：前端加密公钥 */
const FRONTEND_ENCRYPT_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==';
/** A'：后端请求解密私钥（application.yml `api-decrypt.privateKey`） */
const BACKEND_DECRYPT_PRIVATE_KEY =
  'MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAqhHyZfSsYourNxaY7Nt+PrgrxkiA50efORdI5U5lsW79MmFnusUA355oaSXcLhu5xxB38SMSyP2KvuKNPuH3owIDAQABAkAfoiLyL+Z4lf4Myxk6xUDgLaWGximj20CUf+5BKKnlrK+Ed8gAkM0HqoTt2UZwA5E2MzS4EI2gjfQhz5X28uqxAiEA3wNFxfrCZlSZHb0gn2zDpWowcSxQAgiCstxGUoOqlW8CIQDDOerGKH5OmCJ4Z21v+F25WaHYPxCFMvwxpcw99EcvDQIgIdhDTIqD2jfYjPTY8Jj3EDGPbH2HHuffvflECt3Ek60CIQCFRlCkHpi7hthhYhovyloRYsM+IS9h/0BzlEAuO0ktMQIgSPT3aFAgJYwKpqRYKlLDVcflZFCKY7u3UP8iWi1Qw0Y=';
/** B：后端响应加密公钥（application.yml `api-decrypt.publicKey`） */
const BACKEND_RESPONSE_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJnNwrj4hi/y3CCJu868ghCG5dUj8wZK++RNlTLcXoMmdZWEQ/u02RgD5LyLAXGjLOjbMtC+/J9qofpSGTKSx/MCAwEAAQ==';
/** B'：前端解密私钥（`VITE_APP_RSA_PRIVATE_KEY`） */
const FRONTEND_DECRYPT_PRIVATE_KEY =
  'MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAmc3CuPiGL/LcIIm7zryCEIbl1SPzBkr75E2VMtxegyZ1lYRD+7TZGAPkvIsBcaMs6Nsy0L78n2qh+lIZMpLH8wIDAQABAkEAk82Mhz0tlv6IVCyIcw/s3f0E+WLmtPFyR9/WtV3Y5aaejUkU60JpX4m5xNR2VaqOLTZAYjW8Wy0aXr3zYIhhQQIhAMfqR9oFdYw1J9SsNc+CrhugAvKTi0+BF6VoL6psWhvbAiEAxPPNTmrkmrXwdm/pQQu3UOQmc2vCZ5tiKpW10CgJi8kCIFGkL6utxw93Ncj4exE/gPLvKcT+1Emnoox+O9kRXss5AiAMtYLJDaLEzPrAWcZeeSgSIzbL+ecokmFKSDDcRske6QIgSMkHedwND1olF8vlKsJUGK3BcdtM8w4Xq7BpSBwsloE=';

describe('ruoyi-crypto', () => {
  describe('AES（AES-256-ECB/PKCS7，与 hutool SecureUtil.aes 默认一致）', () => {
    it('生成 32 位 AES 密钥（AES-256）', () => {
      const key = generateAesKey();
      expect(key).toHaveLength(32);
      // 两次生成不应相同
      expect(generateAesKey()).not.toBe(key);
    });

    it('加密结果可被同一密钥还原', () => {
      const key = generateAesKey();
      const body = JSON.stringify({ password: 'admin123', username: 'admin' });
      const cipher = encryptByAes(body, key);

      expect(cipher).not.toContain('admin');
      expect(decryptByAes(cipher, key)).toBe(body);
    });

    it('密文为 base64，且按 16 字节分组补齐（PKCS7）', () => {
      const key = generateAesKey();
      const cipher = encryptByAes('123456', key);
      // 6 字节明文经 PKCS7 补齐到 16 字节；密文字节数必须是分组的整数倍
      const { sigBytes } = CryptoJS.enc.Base64.parse(cipher);
      expect(sigBytes).toBe(16);
    });

    it('错误密钥无法还原明文（抛错而不是静默返回空串）', () => {
      const cipher = encryptByAes('{"a":1}', generateAesKey());
      expect(() => decryptByAes(cipher, generateAesKey())).toThrow();
    });

    it('非法密文抛错', () => {
      expect(() => decryptByAes('!!!not-base64!!!', generateAesKey())).toThrow();
      expect(() => decryptByAes('', generateAesKey())).toThrow();
    });
  });

  describe('RSA（RSA/ECB/PKCS1Padding，与 hutool RSA 默认一致）', () => {
    it('请求方向：前端公钥加密 → 后端私钥解密可还原', () => {
      const plain = encryptBase64('0123456789abcdef0123456789abcdef');
      const cipher = encryptByRsa(plain, FRONTEND_ENCRYPT_PUBLIC_KEY);
      expect(cipher).not.toBe(plain);
      expect(decryptByRsa(cipher, BACKEND_DECRYPT_PRIVATE_KEY)).toBe(plain);
    });

    it('响应方向：后端公钥加密 → 前端私钥解密可还原', () => {
      const plain = encryptBase64('0123456789abcdef0123456789abcdef');
      const cipher = encryptByRsa(plain, BACKEND_RESPONSE_PUBLIC_KEY);
      expect(decryptByRsa(cipher, FRONTEND_DECRYPT_PRIVATE_KEY)).toBe(plain);
    });

    it('非法密文抛错', () => {
      expect(() =>
        decryptByRsa('not-a-cipher', BACKEND_DECRYPT_PRIVATE_KEY),
      ).toThrow();
    });

    it('跨对使用密钥无法解密（前端公钥/私钥并非一对）', () => {
      const cipher = encryptByRsa(
        encryptBase64('payload'),
        FRONTEND_ENCRYPT_PUBLIC_KEY,
      );
      expect(() =>
        decryptByRsa(cipher, FRONTEND_DECRYPT_PRIVATE_KEY),
      ).toThrow();
    });
  });

  describe('buildEncryptHeader（请求头 encrypt-key）', () => {
    it('返回 32 位 AES 密钥与可被后端私钥还原的头部值', () => {
      const { aesKey, encryptKey } = buildEncryptHeader(
        FRONTEND_ENCRYPT_PUBLIC_KEY,
      );
      expect(aesKey).toHaveLength(32);
      // 后端：decryptByRsa(header) → base64 → AES 密钥
      expect(
        decryptBase64(decryptByRsa(encryptKey, BACKEND_DECRYPT_PRIVATE_KEY)),
      ).toBe(aesKey);
    });

    it('头部可解出解密 body 所用的 AES 密钥', () => {
      const { aesKey, encryptKey } = buildEncryptHeader(
        FRONTEND_ENCRYPT_PUBLIC_KEY,
      );
      const body = encryptByAes('{"code":"1234"}', aesKey);
      const keyFromHeader = decryptBase64(
        decryptByRsa(encryptKey, BACKEND_DECRYPT_PRIVATE_KEY),
      );
      expect(decryptByAes(body, keyFromHeader)).toBe('{"code":"1234"}');
    });
  });
});
