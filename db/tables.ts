/**
 * Fanfic Generator - create stories based on existing universes (fandoms).
 *
 * Design goals:
 * - Separate Fandom/Universe from individual fanfics.
 * - Each fanfic can have multiple chapters.
 * - Keep metadata like rating, pairing, tags for future filtering.
 */

import { defineTable, column, NOW } from "astro:db";

export const Fandoms = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    // System-level fandoms may be shared; userId optional
    userId: column.text({ optional: true }),
    name: column.text(),                              // "Harry Potter", "Marvel", etc.
    canonType: column.text({ optional: true }),       // "books", "anime", "game", etc.
    description: column.text({ optional: true }),
    isSystem: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const FanficStories = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    fandomId: column.text({
      references: () => Fandoms.columns.id,
      optional: true,
    }),
    title: column.text(),
    summary: column.text({ optional: true }),
    rating: column.text({ optional: true }),          // "G", "PG-13", etc. (we can keep generic labels)
    pairing: column.text({ optional: true }),         // main ships, optional
    tags: column.text({ optional: true }),            // comma-separated or JSON
    status: column.text({ optional: true }),          // "idea", "in-progress", "completed"
    language: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const FanficChapters = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    storyId: column.text({
      references: () => FanficStories.columns.id,
    }),
    orderIndex: column.number(),
    title: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    content: column.text(),                           // full chapter text
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Fandoms,
  FanficStories,
  FanficChapters,
} as const;
