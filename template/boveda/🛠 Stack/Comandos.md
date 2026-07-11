# Comandos

**Propósito**: Referencia rápida de comandos útiles.

---

## Desarrollo

(Pendiente de documentar)

## Migraciones DB

| Motor | Comando |
|-------|---------|
| Supabase | `npx supabase db push` / `npx supabase db diff` |
| PostgreSQL | `psql $DATABASE_URL -f migrations/...` |
| MySQL | `mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < migrations/...` |
| Prisma | `npx prisma migrate dev` / `npx prisma db push` |
| Drizzle | `npx drizzle-kit push` / `npx drizzle-kit generate` |
| SQLite | `sqlite3 $DB_PATH < migrations/...` |
| MongoDB | `mongosh $MONGO_URI --eval "load('migrations/...')"` |

Para ejecutar DDL manual: usar SQL Editor en Supabase Dashboard o cliente directo de BD.
