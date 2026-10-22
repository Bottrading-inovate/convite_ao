import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const weddingGuests = pgTable("wedding_guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestKey: text("guest_key").notNull().unique(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  active: boolean("active").notNull().default(true),
  phone: text("phone"),
  attending: boolean("attending"),
  partySize: integer("party_size").notNull().default(1),
  message: text("message"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WeddingGuest = typeof weddingGuests.$inferSelect;
export type NewWeddingGuest = typeof weddingGuests.$inferInsert;
