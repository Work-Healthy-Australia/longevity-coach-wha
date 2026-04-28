import type { Database } from "@/lib/supabase/database.types";

export type DailyLogRow =
  Database["biomarkers"]["Tables"]["daily_logs"]["Row"];
