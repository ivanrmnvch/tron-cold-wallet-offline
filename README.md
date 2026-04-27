***English** | [Русский](README.ru.md)*

# tron-cold-wallet-offline

TRON USDT cold wallet — **offline machine** toolkit.

Air-gapped wallet generation and transaction signing. No internet required after `npm install`.

Part of a two-machine air-gap workflow:

```
[Online machine] ──► unsigned_tx.json ──► [Offline machine]
[Online machine] ◄── signed_tx.json   ◄── [Offline machine]
```

## Features

- Generate a new TRON wallet (BIP39 24-word mnemonic, BIP32/BIP44 HD derivation)
- Restore wallet from mnemonic and derive private key into RAM
- Sign unsigned USDT TRC-20 transactions — private key never touches disk or internet
- Supports multiple wallets from one mnemonic via wallet index

## Requirements

- Node.js 18+
- Run `npm install` **before taking offline**

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/tron-cold-wallet-offline.git
cd tron-cold-wallet-offline
npm install
# disconnect from internet — this machine should stay offline
```

## Usage

### Generate wallet

```bash
node src/generate-wallet.js
```

Displays the 24-word mnemonic, TRON address, and private key.

**Write the mnemonic on paper. Never save it digitally.**  
After noting everything: `clear && history -c`

### Restore wallet / derive private key

```bash
node src/restore-wallet.js
```

Supports BIP44 wallet index for multiple wallets from the same mnemonic  
(`m/44'/195'/0'/0/<index>`). Index 0 is the default.

### Sign transaction

Copy `unsigned_tx.json` from the online machine via USB, then:

```bash
node src/sign-raw.js
```

The script:
1. Reads and displays the transaction details (recipient address, amount in USDT)
2. Verifies that meta matches the raw transaction bytes — detects tampering
3. Asks for confirmation
4. Prompts for the private key (interactive input, never saved to disk)
5. Verifies the key matches the sender address
6. Signs and writes `signed_tx.json`

Copy `signed_tx.json` back to the online machine and broadcast.

## Security model

| Property | Detail |
|----------|--------|
| Private key storage | RAM only — entered interactively, never written to disk |
| `signed_tx.json` | Contains the signed transaction only — no private key |
| Tamper detection | `sign-raw.js` decodes and verifies raw transaction bytes against metadata |
| Network | This machine must never connect to the internet |

Recommended: full-disk encryption (LUKS), `clear && history -c` after every session.

## Dependencies

All cryptography is provided by audited, minimal, zero-dependency libraries by [Paul Miller](https://github.com/paulmillr):

| Package | Purpose |
|---------|---------|
| `@noble/curves` | secp256k1 ECDSA signing |
| `@noble/hashes` | SHA-256, Keccak-256 |
| `@scure/bip32` | BIP32 HD key derivation |
| `@scure/bip39` | BIP39 mnemonic generation and validation |
| `@scure/base` | Base58Check address encoding |

## Related

- [tron-cold-wallet-online](https://github.com/YOUR_USERNAME/tron-cold-wallet-online) — online companion (zero external deps)
