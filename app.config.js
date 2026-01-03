// app.config.js
export default ({ config }) => ({
  ...config,
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
});
