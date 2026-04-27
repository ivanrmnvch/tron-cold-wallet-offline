'use strict';

const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');
const { sha256 } = require('@noble/hashes/sha256');
const { base58check } = require('@scure/base');

// Base58Check с SHA256 (как Bitcoin и TRON)
const tronBase58 = base58check(sha256);

/**
 * Приватный ключ → TRON-адрес (T...)
 */
function privateKeyToAddress(privateKeyHex) {
  const privBytes = Buffer.from(privateKeyHex, 'hex');

  // Uncompressed public key: 04 || x || y (65 байт)
  const pubKey = secp256k1.getPublicKey(privBytes, false);

  // keccak256 от 64 байт (без префикса 04)
  const pubKeyBody = pubKey.slice(1);
  const keccakHash = keccak_256(pubKeyBody); // 32 байта

  // Последние 20 байт + префикс 0x41 (TRON)
  const addressBytes = new Uint8Array(21);
  addressBytes[0] = 0x41;
  addressBytes.set(keccakHash.slice(12), 1);

  return tronBase58.encode(addressBytes);
}

/**
 * TRON-адрес (T...) → hex (21 байт с префиксом 41)
 */
function tronAddressToHex(base58Addr) {
  return Buffer.from(tronBase58.decode(base58Addr)).toString('hex');
}

/**
 * hex (21 байт) → TRON-адрес (T...)
 */
function hexToTronAddress(hex) {
  return tronBase58.encode(Buffer.from(hex, 'hex'));
}

module.exports = { privateKeyToAddress, tronAddressToHex, hexToTronAddress, sha256, keccak_256, secp256k1 };
