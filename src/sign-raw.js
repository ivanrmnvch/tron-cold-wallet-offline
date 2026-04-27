#!/usr/bin/env node
'use strict';

/**
 * Mode 1: принимает unsigned_tx.json (от TronWeb или pure-crypto create-tx.js),
 * декодирует и верифицирует содержимое, подписывает.
 *
 * Зависимости на офлайн-машине: только @noble/curves + @noble/hashes
 * TronWeb НЕ нужен.
 */

const { secp256k1 } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { privateKeyToAddress, hexToTronAddress } = require('./crypto-utils');
const fs = require('fs');
const readline = require('readline');

const USDT_CONTRACT_HEX = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'; // TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t без 41
const TRANSFER_SELECTOR = 'a9059cbb';

function secureInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

function confirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => { rl.close(); resolve(ans.toLowerCase() === 'yes'); });
  });
}

/**
 * Декодировать ABI data из поля TriggerSmartContract.data
 * Извлечь адрес получателя и сумму для верификации
 */
function decodeTransferData(dataHex) {
  if (dataHex.length < 8 + 64 + 64) return null;
  const selector = dataHex.slice(0, 8);
  if (selector.toLowerCase() !== TRANSFER_SELECTOR) return null;

  const toRaw = dataHex.slice(8, 8 + 64); // 32 bytes, address right-aligned
  const amountRaw = dataHex.slice(8 + 64, 8 + 64 + 64); // 32 bytes, amount

  // ABI кодирует адрес в Ethereum-стиле: 20 байт без префикса 0x41, right-aligned в 32 байтах
  const ethAddr = toRaw.slice(toRaw.length - 40); // последние 20 байт
  const toAddress = hexToTronAddress('41' + ethAddr); // восстановить TRON-префикс

  const amountSun = BigInt('0x' + amountRaw);
  const amountUsdt = Number(amountSun) / 1_000_000;

  return { toAddress, amountSun, amountUsdt };
}

async function main() {
  // Читаем unsigned TX
  if (!fs.existsSync('unsigned_tx.json')) {
    console.error('Файл unsigned_tx.json не найден');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync('unsigned_tx.json', 'utf8'));
  const { transaction, meta } = payload;

  if (!transaction || !transaction.raw_data_hex) {
    console.error('Неверный формат unsigned_tx.json — нет raw_data_hex');
    process.exit(1);
  }

  const rawDataHex = transaction.raw_data_hex;
  const rawDataBytes = Buffer.from(rawDataHex, 'hex');

  // ======= ВЕРИФИКАЦИЯ =======
  // Декодируем что РЕАЛЬНО в raw_data (не только то что написано в meta)
  const contracts = transaction.raw_data?.contract || [];
  let realTo = null, realAmountUsdt = null;

  if (contracts.length > 0) {
    const param = contracts[0]?.parameter?.value;
    if (param?.data) {
      const decoded = decodeTransferData(param.data);
      if (decoded) {
        realTo = decoded.toAddress;
        realAmountUsdt = decoded.amountUsdt;
      }
    }
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         ВЕРИФИКАЦИЯ ТРАНЗАКЦИИ               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║ Из метаданных (заявлено онлайн-машиной):');
  console.log(`║   От:      ${meta?.from || 'N/A'}`);
  console.log(`║   Кому:    ${meta?.to || 'N/A'}`);
  console.log(`║   Сумма:   ${meta?.amount_usdt || 'N/A'} USDT`);
  console.log(`║   Создан:  ${meta?.created_at || 'N/A'}`);
  console.log('╠══════════════════════════════════════════════╣');

  if (realTo && realAmountUsdt !== null) {
    console.log('║ Из raw_data транзакции (РЕАЛЬНЫЕ значения):');
    console.log(`║   Кому:    ${realTo}`);
    console.log(`║   Сумма:   ${realAmountUsdt} USDT`);

    // Сравниваем
    if (meta?.to && realTo !== meta.to) {
      console.log('║');
      console.log('║ !!! АДРЕС ПОЛУЧАТЕЛЯ НЕ СОВПАДАЕТ !!!');
      console.log('║ !!! ВОЗМОЖНА ПОДМЕНА НА ОНЛАЙН-МАШИНЕ !!!');
      console.log('╚══════════════════════════════════════════════╝');
      process.exit(1);
    }
    if (meta?.amount_usdt && Math.abs(realAmountUsdt - meta.amount_usdt) > 0.000001) {
      console.log('║');
      console.log('║ !!! СУММА НЕ СОВПАДАЕТ !!!');
      console.log('╚══════════════════════════════════════════════╝');
      process.exit(1);
    }
    console.log('║');
    console.log('║ Данные совпадают');
  } else {
    console.log('║ Предупреждение: не удалось декодировать raw_data');
    console.log('║ Продолжить только если доверяешь метаданным');
  }

  console.log('╚══════════════════════════════════════════════╝');

  const ok = await confirm('\nПодписать транзакцию? (yes/no): ');
  if (!ok) { console.log('Отменено.'); process.exit(0); }

  // ======= ВВОД КЛЮЧА =======
  const privateKey = await secureInput('\nПриватный ключ (hex): ');

  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('Неверный формат ключа — должно быть 64 hex-символа');
    process.exit(1);
  }

  // Верифицируем что ключ соответствует адресу отправителя
  const derivedAddress = privateKeyToAddress(privateKey);
  if (meta?.from && derivedAddress !== meta.from) {
    console.error(`\nОшибка: ключ соответствует адресу ${derivedAddress}`);
    console.error(`Ожидался: ${meta.from}`);
    process.exit(1);
  }

  // ======= ПОДПИСЬ =======
  // txID = SHA256(raw_data_bytes)
  const txIdBytes = sha256(rawDataBytes);
  const txId = Buffer.from(txIdBytes).toString('hex');

  // Проверяем что наш txID совпадает с тем что в транзакции
  if (transaction.txID && txId !== transaction.txID) {
    console.error('\nОшибка: вычисленный txID не совпадает с транзакцией');
    console.error(`Вычисленный: ${txId}`);
    console.error(`В файле:     ${transaction.txID}`);
    process.exit(1);
  }

  // ECDSA на secp256k1, RFC 6979 детерминированный nonce
  const privKeyBytes = Buffer.from(privateKey, 'hex');
  const sig = secp256k1.sign(txIdBytes, privKeyBytes, { lowS: false });

  // Формат подписи TRON: r (32 байт) || s (32 байт) || v (1 байт)
  const r = Buffer.from(sig.r.toString(16).padStart(64, '0'), 'hex');
  const s = Buffer.from(sig.s.toString(16).padStart(64, '0'), 'hex');
  const v = Buffer.from([sig.recovery]);
  const signatureHex = Buffer.concat([r, s, v]).toString('hex');

  // Собираем подписанную транзакцию
  const signedTx = {
    ...transaction,
    signature: [signatureHex],
  };

  fs.writeFileSync('signed_tx.json', JSON.stringify(signedTx, null, 2));
  console.log('\nПодписано. Сохранено: signed_tx.json');
  console.log('Перенеси на онлайн-машину и запусти broadcast.');
}

main().catch(console.error);
