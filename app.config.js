export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: "com.danish.safespend",
  },
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
});
