# Textile FX dönüşüm sonucu

Durum: **Tamamlandı ve zincirde doğrulandı.**

- Zaman: 2026-11-25 19:42:18–19:43:01 UTC (22:42–22:43 TRT)
- Zincir: Celo mainnet (42220)
- Koridor: **USDT -> cNGN**
- Agent/taker cüzdanı: `0xb48c59869227638743Acae4D2A2A441d98E43f83`
- Alıcı: Gamze — `0x41DB239cb2090668dE70AC8e5580672Df826547F`
- ERC-8021 etiketi: `celo_584ed85bd399`

## Taze firm quote

- RFQ: `rfq_zvZnm5msOVonJ6uN`
- Alındı: 2026-11-25T19:42:32.862Z
- Bitiş / order deadline: 2026-11-25T19:44:33.000Z
- Giriş / takerPays: **9.95 USDT**
- Çıkış: **14,357.521814 cNGN**
- Çıkış atomic: `14357521814`
- Kur: **1,442.967016 cNGN / USDT**
- Protokol ücreti: **0.001989 USDT**
- Önizlemeye göre fark: **-0.0277%** (14,361.501459 cNGN önizlemesine göre; %2 durdurma eşiğinin içinde)

## İşlemler

| Adım | Tx hash | Blok | Durum | Gaz | Ücret |
|---|---|---:|---|---:|---:|
| USDT approval | `0x8db30f7e99f1b9ab04e16d6865aa66b9d9bb653260d8b0cad77a2bb1cedac530` | 83734998 | success | 53,399 | 0.0108132975 CELO |
| Textile FX swap | `0xc0a551fd62cec218f5f2a1f3eb160f9b39d0b1ebc189ccc723634ec61d687459` | 83735001 | success | 217,995 | 0.0441439875 CELO |
| cNGN transferi (Gamze’ye) | `0x70499ea2f59039687f9252b6078e8171917c4bc0ad1e80f28ef9ef30f5db58ed` | 83735015 | success | 82,786 | 0.016764165 CELO |

Toplam gaz: **354,180**  
Toplam gaz ücreti: **0.07172145 CELO**

Swap doğrulaması:

- Swap hedefi: Textile LimitOrderReactor `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`
- Swap calldata uzunluğu: **1,031 byte**
- ERC-8021 suffix calldata sonunda doğrulandı: **evet**
- Tag’li swap data hash: `0x56f1bdd6570ef1c5da22d08035dfc661580be9f1bafb5e40a193535bca76a426`
- Swap sonrası agent cüzdanına gelen cNGN: **14,357.521814 cNGN** (quote ile birebir)

## Bakiyeler

Başlangıç (blok 83734989):

- Agent CELO: 3.771125075
- Agent USDT: 9.95
- Agent cNGN: 0
- Gamze cNGN: 0
- Reactor USDT allowance: 0

Bitiş (blok 83735036, bağımsız tekrar kontrol):

- Agent CELO: 3.699403625
- Agent USDT: 0
- Agent cNGN: 0
- Gamze cNGN: **14,357.521814**

Doğrulama: Gamze cNGN bakiyesi tam swap çıktısı kadar arttı; agent cüzdanında USDT ve cNGN kalmadı.
