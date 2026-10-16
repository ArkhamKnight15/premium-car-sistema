"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export const createBrowser = () => createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
