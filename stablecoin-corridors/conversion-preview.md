# Textile FX dönüşüm önizlemesi

Durum: **Önizleme hazır, işlem gönderilmedi.** Approval, swap veya transfer broadcast edilmedi. Firm quote’lar snapshot sonrası serbest bırakıldı; seçili cNGN quote’u 2026-11-25 19:36:24 UTC’de doldu. Çalıştırma onayı gelirse imzadan hemen önce taze firm quote alınmalı.

Snapshot: 2026-11-25T19:39:51.348Z  
Zincir: Celo mainnet (42220)  
Blok: 83734380  
Agent/taker cüzdanı: `0xb48c59869227638743Acae4D2A2A441d98E43f83`  
Nihai alıcı: Gamze — `0x41DB239cb2090668dE70AC8e5580672Df826547F`  
Bakiyeler: 9.95 USDT, 3.771125075 CELO  
Reactor allowance: 0 USDT

## Seçili koridor

**USDT -> cNGN**

- Giriş / takerPays: **9.95 USDT**
- Beklenen çıkış: **14,361.501459 cNGN**
- Çıkış atomic: `14361501459`
- Kur: **1,443.366981 cNGN / USDT**
- Protokol ücreti: **0.001989 USDT** (yaklaşık 2 bps; takerPays içinde)
- Maker’a giden order output’u: 9.948011 USDT
- Ters önizleme değeri: 9.944025 USDT
- Gidiş-dönüş gösterge kaybı: 0.005975 USDT

Seçim gerekçesi: Üç koridorda da protokol ücreti aynı. cNGN, ters önizlemede en yüksek USDT değerini verdi (9.944025 USDT). wBRL gazı daha düşük olsa da cNGN’nin değer avantajı gaz farkından büyük.

## Firm quote karşılaştırması

| Koridor | Firm çıkış | Kur | Ücret | Ters önizleme | Toplam gaz |
|---|---:|---:|---:|---:|---:|
| USDT -> cNGN | 14,361.501459 cNGN | 1,443.366981 cNGN/USDT | 0.001989 USDT | 9.944025 USDT | 384,929 |
| USDT -> IDRX | 182,911.55 IDRX | 18,383.070352 IDRX/USDT | 0.001989 USDT | 9.934134 USDT | 427,967 |
| USDT -> wBRL | 57.825176027273317582 wBRL | 5.811575 wBRL/USDT | 0.001989 USDT | 9.936267 USDT | 319,245 |

Quote zamanları UTC:

- cNGN: alındı 19:33:36, bitiş 19:36:24, RFQ `rfq_oHXClJdjhuE8aZIr`
- IDRX: alındı 19:36:25, bitiş 19:39:08, RFQ `rfq_gj7Thx2Q06FYp1hc`
- wBRL: alındı 19:39:09, bitiş 19:41:40, RFQ `rfq_UjT1ZIGlwRz5ZH8c`

## Alıcı doğrulaması

**Swap çıktısı Gamze’ye doğrudan gitmiyor.**

Textile RFQ quote’u `taker` olarak agent cüzdanını bağlıyor. Decode edilen `executeBatch` order’ında:

- Swapper/maker: `0xa601E4AdAE099c1C98a2186Fc0A151DC4BFBBA40`
- Order input: 14,361.501459 cNGN
- Order output: 9.948011 USDT, recipient maker
- Gamze adresi swap calldata içinde yok: `false`

Bu modelde cNGN, swap sonrası filler/taker olan agent cüzdanına gelir. Gamze’ye ulaşması için swap sonrası ayrı bir ERC-20 transferi gerekir:

`transfer(0x41DB239cb2090668dE70AC8e5580672Df826547F, 14361501459)` on cNGN.

Aşağıdaki gaz toplamı bu ayrı transferi de içerir.

## Tag durumu

- Tag: `celo_584ed85bd399`
- Suffix: `0x63656c6f5f353834656438356264333939110080218021802180218021802180218021`
- Textile yanıtındaki `attributionSuffix`: null
- Durum: Suffix, önizlemede `transactions.swap.data` sonuna eklendi.
- Tag’li swap data uzunluğu: 1031 byte
- Tag’li swap data hash: `0x179b0705ad9cd6022b006825386886f622e4877e42ee1561597064cdc7661d5f`

## Gaz ve maliyet

Gaz fiyatı snapshot: 202.5 gwei.

| Adım | Gaz |
|---|---:|
| USDT approval | 54,194 |
| Tag’li swap | 236,578 |
| cNGN transferi (Gamze’ye) | 94,157 |
| **Toplam** | **384,929** |

- Toplam gaz: **0.0779481225 CELO**
- CELO fiyatı varsayımı: 0.05601 USDT (2026-11-25T19:22:16Z snapshot)
- Gaz karşılığı: yaklaşık **0.004366 USDT**
- Protokol ücreti: **0.001989 USDT**
- **Açık toplam maliyet: yaklaşık 0.006355 USDT**

Not: 0.005975 USDT gidiş-dönüş gösterge kaybı açık maliyete ayrıca eklenmez; ters önizlemenin spread/ücret etkisini gösteren ayrı bir değer karşılaştırmasıdır.

Swap gazı, mevcut allowance 0 olduğu için allowance state-override ile tahmin edildi. Transfer gazı, swap öncesi agent cüzdanında cNGN olmadığı için maker -> Gamze transferi proxy’siyle tahmin edildi.

## Onaylanırsa çalıştırma sırası

1. Taze firm quote al.
2. `takerPays` kadar USDT’yi LimitOrderReactor’a approve et ve approval makbuzunu bekle.
3. ERC-8021 suffix’ini swap data sonuna ekle.
4. Swap’ı agent cüzdanından gönder.
5. Gelen cNGN’nin tamamını Gamze adresine transfer et.
6. Bakiyeleri ve tx makbuzlarını doğrula.
