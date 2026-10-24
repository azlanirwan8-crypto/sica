import { customType } from 'drizzle-orm/pg-core';

// drizzle-orm 0.33 belum punya builder `bytea` → dipetakan via customType.
// Driver postgres-js sudah mengirim/menerima Buffer, jadi serialisasinya identitas.
export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});
