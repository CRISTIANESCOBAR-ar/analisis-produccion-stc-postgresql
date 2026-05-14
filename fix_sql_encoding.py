import sys, os

src  = '/mnt/c/stc-produccion-v2/backups/sync/sync_2026-05-02_13-48-52.sql'
dest = '/mnt/c/stc-produccion-v2/backups/sync/sync_2026-05-02_13-48-52_fixed.sql'

# Char Ç (U+00C7, UTF-8: C3 87) fue mojibake-ado via CP437:
# byte C3 -> CP437 char ├ (U+251C) -> UTF-8: E2 94 9C
# byte 87 -> CP437 char ç (U+00E7) -> UTF-8: C3 A7
BAD  = bytes([0xE2, 0x94, 0x9C, 0xC3, 0xA7])
GOOD = bytes([0xC3, 0x87])

CHUNK = 8 * 1024 * 1024  # 8 MB

total_in = 0
total_replaced = 0

with open(src, 'rb') as fin, open(dest, 'wb') as fout:
    carry = b''
    while True:
        data = fin.read(CHUNK)
        if not data:
            result = carry.replace(BAD, GOOD)
            total_replaced += carry.count(BAD)
            fout.write(result)
            break
        buf = carry + data
        carry = buf[-4:]
        buf   = buf[:-4]
        total_replaced += buf.count(BAD)
        fout.write(buf.replace(BAD, GOOD))
        total_in += len(data)
        mb = total_in // (1024 * 1024)
        if mb % 100 == 0:
            print(f'{mb} MB procesados...', flush=True)

print(f'Listo. {total_replaced} sustituciones.')
print(f'Original: {os.path.getsize(src):,} bytes')
print(f'Corregido: {os.path.getsize(dest):,} bytes')
