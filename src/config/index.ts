export const config = {
  pocketbase: {
    url: process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://get.piksel.lt',
    collection: 'orders'
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://titkwifsatjemnquyrij.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bXgkXQ6_FY3CdnPRHZ-onA_p-bjSFM_'
  },
  app: {
    name: 'Piksel Orders',
    description: 'Modernus užsakymų valdymo sistema'
  }
};
