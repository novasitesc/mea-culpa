"use client";

import { useState } from "react";

export type RewardItem = { id: string; objectId: number | null; qty: number };
export type Reward = { gold: number; levelUps: number; items: RewardItem[] };
export type RewardsState = Record<number, Reward>;

const EMPTY_REWARD: Reward = { gold: 0, levelUps: 0, items: [] };

function mkId() {
  return Math.random().toString(36).slice(2, 9);
}

export function useRewardsState(initial: RewardsState = {}) {
  const [rewards, setRewards] = useState<RewardsState>(initial);

  function updateReward(id: number, updates: Partial<Pick<Reward, "gold" | "levelUps">>) {
    setRewards((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_REWARD), ...updates },
    }));
  }

  function addItem(id: number) {
    setRewards((prev) => {
      const cur = prev[id] ?? EMPTY_REWARD;
      return { ...prev, [id]: { ...cur, items: [...cur.items, { id: mkId(), objectId: null, qty: 1 }] } };
    });
  }

  function updateItem(id: number, itemId: string, updates: Partial<RewardItem>) {
    setRewards((prev) => {
      const cur = prev[id] ?? EMPTY_REWARD;
      return { ...prev, [id]: { ...cur, items: cur.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)) } };
    });
  }

  function removeItem(id: number, itemId: string) {
    setRewards((prev) => {
      const cur = prev[id] ?? EMPTY_REWARD;
      return { ...prev, [id]: { ...cur, items: cur.items.filter((it) => it.id !== itemId) } };
    });
  }

  return { rewards, setRewards, updateReward, addItem, updateItem, removeItem };
}
