// utils/supabase.js
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {};

const supabaseUrl = extra.supabaseUrl;
const supabaseServiceRoleKey = extra.supabaseServiceRoleKey;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase environment variables not loaded");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);