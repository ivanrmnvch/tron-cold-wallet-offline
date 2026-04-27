#!/usr/bin/env node
'use strict';

const { mnemonicToSeedSync, validateMnemonic } = require('@scure/bip39');
const { wordlist } = require('@scure/bip39/wordlists/english');
const { HDKey } = require('@scure/bip32');
const { privateKeyToAddress } = require('./crypto-utils');
const readline = require('readline');

const TRON_PATH = (index) => `m/44'/195'/0'/0/${index}`;

function secureInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function main() {
  console.log('=== ВОССТАНОВЛЕНИЕ КОШЕЛЬКА ===\n');

  const mnemonic = await secureInput('Введи мнемонику (24 слова): ');

  if (!validateMnemonic(mnemonic, wordlist)) {
    console.error('Ошибка: недействительная мнемоника (неверная контрольная сумма или слова)');
    process.exit(1);
  }

  const passphrase = await secureInput('Passphrase (Enter если не использовался): ');

  const indexInput = await secureInput('Индекс кошелька (Enter = 0): ');
  const index = indexInput === '' ? 0 : parseInt(indexInput, 10);
  if (isNaN(index) || index < 0) {
    console.error('Неверный индекс');
    process.exit(1);
  }

  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(TRON_PATH(index));
  if (!child.privateKey) throw new Error('Ошибка деривации');

  const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
  const address = privateKeyToAddress(privateKeyHex);

  console.log('\n=== ВОССТАНОВЛЕН ===');
  console.log(`Путь:        ${TRON_PATH(index)}`);
  console.log(`Адрес:       ${address}`);
  console.log(`Passphrase:  ${passphrase ? 'ИСПОЛЬЗОВАН' : 'НЕТ'}`);
  console.log(`Private Key: ${privateKeyHex}`);
  console.log('\nСравни адрес с ожидаемым.');
  console.log('Если не совпадает — проверь passphrase и индекс.');
}

main().catch(console.error);
