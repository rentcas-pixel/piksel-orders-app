export const config = {
  pocketbase: {
    url: process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://get.piksel.lt',
    collection: 'orders'
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  },
  app: {
    name: 'Piksel Orders',
    description: 'Modernus užsakymų valdymo sistema'
  }
};
