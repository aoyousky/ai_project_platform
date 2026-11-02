/**
 * RuoYi-Vue-Plus 传输加密（与后端 `aoyou-common-encrypt` 对齐）
 *
 * 协议（见 specs/001-vben-frontend-replacement/contracts/backend-api-consumed.md）：
 * 1. 前端随机生成 32 位 AES 密钥；
 * 2. 请求头 `encrypt-key` = RSA(公钥加密, base64(AES 密钥))；
 * 3. 请求体 = AES-256-ECB/PKCS7(JSON) 的 base64；
 * 4. 响应头带 `encrypt-key` 时，body 用 RSA 私钥还原出的 AES 密钥解密。
 *
 * 后端实现：`EncryptUtils.encryptByAes` 用 hutool `SecureUtil.aes`（AES/ECB/PKCS5Padding，
 * 与 PKCS7 在 16 字节分组下等价）；`decryptByRsa` 为 hutool RSA 默认（RSA/ECB/PKCS1Padding）。
 *
 * ⚠️ 后端 `api-decrypt` 是**两对独立密钥**（见 platform/aoyou-admin/src/main/resources/application.yml）：
 * - 请求：前端 `VITE_APP_RSA_PUBLIC_KEY` 加密，后端 `api-decrypt.privateKey` 解密；
 * - 响应：后端 `api-decrypt.publicKey` 加密，前端 `VITE_APP_RSA_PRIVATE_KEY` 解密。
 * 所以前端持有的公钥与私钥不是一对，互相不能加解密（plus-ui 也是如此）。
 */
import CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt';

/** AES-256：密钥 32 字节（字符） */
const AES_KEY_LENGTH = 32;
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** 传输加密开关用到的请求头名 */
export const ENCRYPT_KEY_HEADER = 'encrypt-key';

export interface EncryptHeader {
  /** 本次请求使用的 AES 密钥（明文，仅用于加密 body） */
  aesKey: string;
  /** 放入 `encrypt-key` 请求头的值（RSA 密文 base64） */
  encryptKey: string;
}

/**
 * 生成 AES 密钥。优先用 CSPRNG；无 `crypto.getRandomValues` 时退回 Math.random
 * （仅影响密钥强度，不影响与后端的互通性）。
 */
export function generateAesKey(): string {
  const bytes = new Uint8Array(AES_KEY_LENGTH);
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
    let key = '';
    for (const byte of bytes) {
      key += BASE64_CHARS[byte % BASE64_CHARS.length];
    }
    return key;
  }
  let key = '';
  for (let i = 0; i < AES_KEY_LENGTH; i += 1) {
    key += BASE64_CHARS.charAt(Math.floor(Math.random() * BASE64_CHARS.length));
  }
  return key;
}

/** Base64 编码（UTF-8 文本 → base64） */
export function encryptBase64(data: string): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
}

/** Base64 解码（base64 → UTF-8 文本）；非法输入抛错 */
export function decryptBase64(data: string): string {
  if (!data) {
    throw new Error('Base64 解码失败：输入为空');
  }
  const text = CryptoJS.enc.Base64.parse(data).toString(CryptoJS.enc.Utf8);
  if (!text) {
    throw new Error('Base64 解码失败：内容不是合法的 base64');
  }
  return text;
}

/** AES-256-ECB/PKCS7 加密，返回 base64 密文 */
export function encryptByAes(data: string, aesKey: string): string {
  const key = CryptoJS.enc.Utf8.parse(aesKey);
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

/** AES-256-ECB/PKCS7 解密；密钥不符或密文损坏时抛错，不返回空串 */
export function decryptByAes(data: string, aesKey: string): string {
  if (!data) {
    throw new Error('AES 解密失败：密文为空');
  }
  const key = CryptoJS.enc.Utf8.parse(aesKey);
  const decrypted = CryptoJS.AES.decrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  if (!text) {
    throw new Error('AES 解密失败：密钥不匹配或密文损坏');
  }
  return text;
}

/** RSA 公钥加密（RSA/ECB/PKCS1Padding），返回 base64 密文 */
export function encryptByRsa(data: string, publicKey: string): string {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKey);
  const result = encryptor.encrypt(data);
  if (!result) {
    throw new Error('RSA 加密失败：请检查 VITE_APP_RSA_PUBLIC_KEY');
  }
  return result;
}

/** RSA 私钥解密（RSA/ECB/PKCS1Padding） */
export function decryptByRsa(data: string, privateKey: string): string {
  const decryptor = new JSEncrypt();
  decryptor.setPrivateKey(privateKey);
  const result = decryptor.decrypt(data);
  if (!result) {
    throw new Error('RSA 解密失败：请检查 VITE_APP_RSA_PRIVATE_KEY 或密文');
  }
  return result;
}

/**
 * 构造一次加密请求所需的密钥对：
 * `encryptKey` 放请求头，`aesKey` 用于加密 body。
 */
export function buildEncryptHeader(publicKey: string): EncryptHeader {
  const aesKey = generateAesKey();
  const encryptKey = encryptByRsa(encryptBase64(aesKey), publicKey);
  return { aesKey, encryptKey };
}

/**
 * 解密响应体：从响应头 `encrypt-key` 还原 AES 密钥并解出 JSON 文本。
 * 调用方负责判断响应头是否存在。
 */
export function decryptResponseBody(
  body: string,
  encryptKey: string,
  privateKey: string,
): string {
  const aesKey = decryptBase64(decryptByRsa(encryptKey, privateKey));
  return decryptByAes(body, aesKey);
}
