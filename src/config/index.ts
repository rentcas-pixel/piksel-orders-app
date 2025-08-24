export const config = {
  pocketbase: {
    url: process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://get.piksel.lt',
    collection: 'orders'
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://titkwifsatjemnquyrij.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdGt3aWZzYXRqZW1ucXV5cmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDAxMTUsImV4cCI6MjA3MTYxNjExNX0.IAsofq1PgMxrAqkzGKrnmjiB3d9AqCdbo6uw5TXChUo'
  },
  app: {
    name: 'Piksel Orders',
    description: 'Modernus užsakymų valdymo sistema'
  }
};
