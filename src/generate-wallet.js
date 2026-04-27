#!/usr/bin/env node
'use strict';

const { mnemonicToSeedSync, generateMnemonic } = require('@scure/bip39');
const { wordlist } = require('@scure/bip39/wordlists/english');
const { HDKey } = require('@scure/bip32');
const { privateKeyToAddress } = require('./crypto-utils');
const readline = require('readline');

// TRON BIP44 derivation path
const TRON_PATH = "m/44'/195'/0'/0/0";

function secureInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function main() {
  console.log('=== ГЕНЕРАЦИЯ КОШЕЛЬКА (запускать только ОФЛАЙН) ===\n');

  // Генерация 24-словной мнемоники через криптографически безопасный CSPRNG
  const mnemonic = generateMnemonic(wordlist, 256); // 256 бит энтропии = 24 слова

  // Опциональный passphrase (25-е слово)
  console.log('Passphrase — дополнительная защита. Без него мнемоника даёт другой (пустой) адрес.');
  console.log('Если не нужен — нажми Enter.\n');
  const passphrase = await secureInput('Passphrase: ');

  // BIP39: мнемоника + passphrase → seed (512 бит)
  const seed = mnemonicToSeedSync(mnemonic, passphrase);

  // BIP32: seed → HD дерево → приватный ключ
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(TRON_PATH);
  if (!child.privateKey) throw new Error('Ошибка деривации ключа');

  const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
  const address = privateKeyToAddress(privateKeyHex);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║           НОВЫЙ КОШЕЛЁК                  ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║ Мнемоника:`);
  console.log(`║ ${mnemonic}`);
  console.log('╠══════════════════════════════════════════╣');
  if (passphrase) {
    console.log(`║ Passphrase:  УСТАНОВЛЕН (записать ОТДЕЛЬНО)`);
  } else {
    console.log(`║ Passphrase:  НЕ УСТАНОВЛЕН`);
  }
  console.log(`║ Путь:        ${TRON_PATH}`);
  console.log(`║ Адрес:       ${address}`);
  console.log(`║ Private Key: ${privateKeyHex}`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║ ИНСТРУКЦИИ:');
  console.log('║  1. Запиши мнемонику на бумагу (2 копии в разных местах)');
  if (passphrase) {
    console.log('║  2. Запиши passphrase ОТДЕЛЬНО от мнемоники');
    console.log('║  3. Запиши адрес — передашь на онлайн-машину');
    console.log('║  4. НЕ фотографируй, НЕ сохраняй в файл');
    console.log('║  5. clear && history -c');
  } else {
    console.log('║  2. Запиши адрес — передашь на онлайн-машину');
    console.log('║  3. НЕ фотографируй, НЕ сохраняй в файл');
    console.log('║  4. clear && history -c');
  }
  console.log('╚══════════════════════════════════════════╝');
}

main().catch(console.error);
