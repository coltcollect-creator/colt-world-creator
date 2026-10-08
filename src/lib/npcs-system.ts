import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { supabase } from "@/integrations/supabase/client";

export type TriviaQuestion = {
  id: string;
  question: string;
  options: string[]; // 4 multiple choice options
  correct_index: number;
  reward_type: "xp" | "gems" | "cosmetic" | "product";
  reward_amount?: number;
  reward_product_id?: string;
  reward_cosmetic_id?: string;
  reward_label: string;
};

export type ProfessorConfig = {
  questions: TriviaQuestion[];
};

export type MysteryVendorProduct = {
  id: string;
  name: string;
  price_credits: number;
  image_url?: string;
  description?: string;
};

export type GroupBuyItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  target_members?: number;
  active: boolean;
  signups: Array<{
    user_id: string;
    username: string;
    email: string;
    phone: string;
    created_at: string;
  }>;
};

export type RoomLockRule = {
  is_locked: boolean;
  lock_type: "none" | "level" | "password" | "album_card" | "cosmetic";
  min_level?: number;
  password?: string;
  required_card_id?: string;
  required_cosmetic_id?: string;
  lock_message?: string;
};
