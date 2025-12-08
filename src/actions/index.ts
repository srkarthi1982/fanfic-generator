import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { Fandoms, FanficChapters, FanficStories, and, db, eq, or } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function ensureFandomAccessible(fandomId: string, userId: string) {
  const [fandom] = await db.select().from(Fandoms).where(eq(Fandoms.id, fandomId));

  if (!fandom) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Fandom not found.",
    });
  }

  if (fandom.userId && fandom.userId !== userId && !fandom.isSystem) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this fandom.",
    });
  }

  return fandom;
}

async function getOwnedStory(storyId: string, userId: string) {
  const [story] = await db
    .select()
    .from(FanficStories)
    .where(and(eq(FanficStories.id, storyId), eq(FanficStories.userId, userId)));

  if (!story) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Fanfic story not found.",
    });
  }

  return story;
}

async function getOwnedChapter(chapterId: string, storyId: string, userId: string) {
  await getOwnedStory(storyId, userId);

  const [chapter] = await db
    .select()
    .from(FanficChapters)
    .where(and(eq(FanficChapters.id, chapterId), eq(FanficChapters.storyId, storyId)));

  if (!chapter) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Chapter not found.",
    });
  }

  return chapter;
}

export const server = {
  listFandoms: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const fandoms = await db
        .select()
        .from(Fandoms)
        .where(or(eq(Fandoms.userId, user.id), eq(Fandoms.userId, null)));

      return { success: true, data: { items: fandoms, total: fandoms.length } };
    },
  }),

  createFandom: defineAction({
    input: z.object({
      name: z.string().min(1),
      canonType: z.string().optional(),
      description: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [fandom] = await db
        .insert(Fandoms)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          canonType: input.canonType,
          description: input.description,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { fandom } };
    },
  }),

  updateFandom: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        canonType: z.string().optional(),
        description: z.string().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.canonType !== undefined ||
          input.description !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const fandom = await ensureFandomAccessible(input.id, user.id);

      if (fandom.userId && fandom.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You do not have access to update this fandom.",
        });
      }

      const [updated] = await db
        .update(Fandoms)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.canonType !== undefined ? { canonType: input.canonType } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Fandoms.id, input.id))
        .returning();

      return { success: true, data: { fandom: updated } };
    },
  }),

  createFanficStory: defineAction({
    input: z.object({
      fandomId: z.string().optional(),
      title: z.string().min(1),
      summary: z.string().optional(),
      rating: z.string().optional(),
      pairing: z.string().optional(),
      tags: z.string().optional(),
      status: z.string().optional(),
      language: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.fandomId) {
        await ensureFandomAccessible(input.fandomId, user.id);
      }

      const now = new Date();
      const [story] = await db
        .insert(FanficStories)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          fandomId: input.fandomId ?? null,
          title: input.title,
          summary: input.summary,
          rating: input.rating,
          pairing: input.pairing,
          tags: input.tags,
          status: input.status,
          language: input.language,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { story } };
    },
  }),

  updateFanficStory: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        fandomId: z.string().optional(),
        title: z.string().optional(),
        summary: z.string().optional(),
        rating: z.string().optional(),
        pairing: z.string().optional(),
        tags: z.string().optional(),
        status: z.string().optional(),
        language: z.string().optional(),
      })
      .refine(
        (input) =>
          input.fandomId !== undefined ||
          input.title !== undefined ||
          input.summary !== undefined ||
          input.rating !== undefined ||
          input.pairing !== undefined ||
          input.tags !== undefined ||
          input.status !== undefined ||
          input.language !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const story = await getOwnedStory(input.id, user.id);

      if (input.fandomId !== undefined && input.fandomId !== null) {
        await ensureFandomAccessible(input.fandomId, user.id);
      }

      const [updated] = await db
        .update(FanficStories)
        .set({
          ...(input.fandomId !== undefined ? { fandomId: input.fandomId } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.pairing !== undefined ? { pairing: input.pairing } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          updatedAt: new Date(),
        })
        .where(eq(FanficStories.id, input.id))
        .returning();

      return { success: true, data: { story: updated } };
    },
  }),

  listFanficStories: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const stories = await db
        .select()
        .from(FanficStories)
        .where(eq(FanficStories.userId, user.id));

      return { success: true, data: { items: stories, total: stories.length } };
    },
  }),

  createFanficChapter: defineAction({
    input: z.object({
      storyId: z.string().min(1),
      orderIndex: z.number().int().optional(),
      title: z.string().optional(),
      notes: z.string().optional(),
      content: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedStory(input.storyId, user.id);

      const now = new Date();
      const [chapter] = await db
        .insert(FanficChapters)
        .values({
          id: crypto.randomUUID(),
          storyId: input.storyId,
          orderIndex: input.orderIndex ?? 1,
          title: input.title,
          notes: input.notes,
          content: input.content,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { chapter } };
    },
  }),

  updateFanficChapter: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        storyId: z.string().min(1),
        orderIndex: z.number().int().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        content: z.string().optional(),
      })
      .refine(
        (input) =>
          input.orderIndex !== undefined ||
          input.title !== undefined ||
          input.notes !== undefined ||
          input.content !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedChapter(input.id, input.storyId, user.id);

      const [chapter] = await db
        .update(FanficChapters)
        .set({
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          updatedAt: new Date(),
        })
        .where(eq(FanficChapters.id, input.id))
        .returning();

      return { success: true, data: { chapter } };
    },
  }),

  deleteFanficChapter: defineAction({
    input: z.object({
      id: z.string().min(1),
      storyId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedChapter(input.id, input.storyId, user.id);

      const result = await db.delete(FanficChapters).where(eq(FanficChapters.id, input.id));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Chapter not found.",
        });
      }

      return { success: true };
    },
  }),

  listFanficChapters: defineAction({
    input: z.object({
      storyId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedStory(input.storyId, user.id);

      const chapters = await db
        .select()
        .from(FanficChapters)
        .where(eq(FanficChapters.storyId, input.storyId));

      return { success: true, data: { items: chapters, total: chapters.length } };
    },
  }),
};
