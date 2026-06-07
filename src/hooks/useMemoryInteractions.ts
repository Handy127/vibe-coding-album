import { useCallback, useEffect, useState } from 'react';
import type { Memory } from '../types/memory';

export const MAX_MEMORY_COMMENT_LENGTH = 120;

type StoredMemoryInteraction = {
  likes?: number;
  comments?: string[];
};

type StoredMemoryInteractions = Record<string, StoredMemoryInteraction>;

const STORAGE_KEY = 'my-senior-high-school-memory-album:v1:interactions';
const EMPTY_COMMENTS: string[] = [];

function readStoredMemoryInteractions(): StoredMemoryInteractions {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue as StoredMemoryInteractions).map(([memoryId, interaction]) => {
        const likes = Number.isFinite(interaction?.likes) ? interaction.likes : undefined;
        const comments = Array.isArray(interaction?.comments)
          ? interaction.comments.filter((comment) => typeof comment === 'string')
          : [];

        return [memoryId, { likes, comments }];
      }),
    );
  } catch {
    return {};
  }
}

function normalizeComment(comment: string) {
  return comment.trim().replace(/\s+/g, ' ').slice(0, MAX_MEMORY_COMMENT_LENGTH);
}

export function useMemoryInteractions() {
  const [interactions, setInteractions] = useState<StoredMemoryInteractions>(
    readStoredMemoryInteractions,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(interactions));
    } catch {
      // The album still works for the current visit if browser storage is unavailable.
    }
  }, [interactions]);

  const getLikeCount = useCallback(
    (memory: Memory) => interactions[memory.id]?.likes ?? memory.likes,
    [interactions],
  );

  const getComments = useCallback(
    (memoryId: string) => interactions[memoryId]?.comments ?? EMPTY_COMMENTS,
    [interactions],
  );

  const likeMemory = useCallback((memory: Memory) => {
    setInteractions((currentInteractions) => {
      const currentInteraction = currentInteractions[memory.id];
      const currentLikes = currentInteraction?.likes ?? memory.likes;

      return {
        ...currentInteractions,
        [memory.id]: {
          likes: currentLikes + 1,
          comments: currentInteraction?.comments ?? EMPTY_COMMENTS,
        },
      };
    });
  }, []);

  const addComment = useCallback((memoryId: string, comment: string) => {
    const nextComment = normalizeComment(comment);

    if (!nextComment) {
      return false;
    }

    setInteractions((currentInteractions) => {
      const currentInteraction = currentInteractions[memoryId];

      return {
        ...currentInteractions,
        [memoryId]: {
          ...currentInteraction,
          comments: [...(currentInteraction?.comments ?? EMPTY_COMMENTS), nextComment],
        },
      };
    });

    return true;
  }, []);

  return {
    addComment,
    getComments,
    getLikeCount,
    likeMemory,
  };
}
