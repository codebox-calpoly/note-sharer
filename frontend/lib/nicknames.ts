/**
 * Nickname generator for anonymous user identities (Kahoot-style)
 * Generates random names like "PurpleElephant42", "SwiftTiger89", etc.
 */

import { createClient } from "@supabase/supabase-js";

// Infer the SupabaseClient type from createClient
type SupabaseClient = ReturnType<typeof createClient>;

// Adjectives for the first part of the nickname
const ADJECTIVES = [
  "Swift", "Bold", "Clever", "Bright", "Calm", "Cool", "Fast", "Fierce",
  "Gentle", "Happy", "Kind", "Lucky", "Mighty", "Noble", "Quick", "Rapid",
  "Silent", "Smart", "Swift", "Tough", "Wise", "Brave", "Clever", "Daring",
  "Eager", "Fancy", "Golden", "Jolly", "Lively", "Merry", "Proud", "Royal",
  "Sharp", "Smooth", "Stellar", "Vivid", "Witty", "Zesty", "Amber", "Azure",
  "Crimson", "Emerald", "Ivory", "Jade", "Magenta", "Navy", "Olive", "Purple",
  "Ruby", "Sapphire", "Teal", "Violet", "Amber", "Bronze", "Copper", "Silver"
];

// Nouns/Animals for the second part of the nickname
const NOUNS = [
  "Tiger", "Eagle", "Lion", "Wolf", "Bear", "Hawk", "Fox", "Panther",
  "Falcon", "Jaguar", "Leopard", "Cheetah", "Dolphin", "Shark", "Whale",
  "Dragon", "Phoenix", "Griffin", "Unicorn", "Pegasus", "Elephant", "Rhino",
  "Hippo", "Giraffe", "Zebra", "Panda", "Koala", "Penguin", "Owl", "Raven",
  "Swan", "Peacock", "Falcon", "Hawk", "Eagle", "Osprey", "Kestrel", "Vulture",
  "Stallion", "Mustang", "Stallion", "Colt", "Mare", "Pony", "Camel", "Llama",
  "Alpaca", "Bison", "Buffalo", "Elk", "Deer", "Moose", "Caribou", "Antelope",
  "Gazelle", "Impala", "Springbok", "Wildebeest", "Yak", "Bison", "Ox", "Bull"
];

/**
 * Generates a random nickname in the format: [Adjective][Noun][Number]
 * Example: "PurpleElephant42", "SwiftTiger89"
 */
export function generateRandomNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 100); // 0-99

  return `${adjective}${noun}${number}`;
}

/**
 * Checks if a nickname is unique in the database
 * @param nickname - The nickname to check
 * @param supabaseClient - Supabase client instance
 * @returns Promise<boolean> - true if unique, false if already exists
 */
export async function isNicknameUnique(
  nickname: string,
  supabaseClient: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("handle")
    .eq("handle", nickname)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "no rows returned" which is fine (means unique)
    // Other errors are unexpected
    console.error("Error checking nickname uniqueness:", error);
    return false; // Assume not unique on error to be safe
  }

  // If data exists, nickname is not unique
  return !data;
}

/**
 * Generates a unique nickname by checking against the database
 * Will retry up to maxAttempts times if collisions occur
 * @param supabaseClient - Supabase client instance
 * @param maxAttempts - Maximum number of attempts (default: 10)
 * @returns Promise<string> - A unique nickname
 * @throws Error if unable to generate unique nickname after maxAttempts
 */
export async function generateUniqueNickname(
  supabaseClient: SupabaseClient,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nickname = generateRandomNickname();
    const isUnique = await isNicknameUnique(nickname, supabaseClient);

    if (isUnique) {
      return nickname;
    }

    // If not unique, try again (this is rare but possible)
    // eslint-disable-next-line no-console
    console.log(`Nickname collision: ${nickname}, retrying... (attempt ${attempt + 1}/${maxAttempts})`);
  }

  // If we've exhausted all attempts, throw an error
  // This should be extremely rare given the large namespace
  throw new Error(
    `Unable to generate unique nickname after ${maxAttempts} attempts. Please try again.`
  );
}

/**
 * Generates multiple random nicknames (for testing or preview purposes)
 * @param count - Number of nicknames to generate
 * @returns Array of random nicknames
 */
export function generateRandomNicknames(count: number): string[] {
  const nicknames: string[] = [];
  for (let i = 0; i < count; i++) {
    nicknames.push(generateRandomNickname());
  }
  return nicknames;
}

