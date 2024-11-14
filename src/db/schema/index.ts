import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").unique().notNull().primaryKey().defaultRandom(),
    email: varchar("email").notNull().unique(),
    password: varchar("password"),
    fullName: varchar("full_name"),
    isVerified: boolean("is_verified").default(false),
    verificationToken: varchar("verification_token"),
    resetPasswordToken: varchar("reset_password_token"),
    oAuthProvider: varchar("oauth_provider"),
    oAuthId: varchar("oauth_id"),
    oAuthAccessToken: text("oauth_access_token"),
    oAuthRefreshToken: text("oauth_refresh_token"),
    oAuthTokenExpiresAt: timestamp("oauth_token_expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => {
    return {
      emailIndex: uniqueIndex("emailIndex").on(table.email),
      oAuthIndex: uniqueIndex("oAuthIndex").on(table.oAuthProvider, table.oAuthId),
    };
  }
);

export const todos = pgTable("todos", {
  id: uuid("id").unique().notNull().primaryKey().defaultRandom(),
  title: varchar("title").notNull(),
  description: text("description"),
  completed: boolean("completed").default(false),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
