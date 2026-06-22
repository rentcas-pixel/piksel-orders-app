export type AppTab = 'orders' | 'invoices' | 'revenue' | 'partners' | 'agencies' | 'analytics' | 'latest';

export const PAGE_META: Record<AppTab, { title: string; description: string }> = {
  orders: {
    title: 'Užsakymai',
    description: 'Valdykite reklamos užsakymus, statusus ir sąskaitas.',
  },
  invoices: {
    title: 'Sąskaitos',
    description: 'Išrašytos sąskaitos ir laisvos sąskaitos.',
  },
  revenue: {
    title: 'Ekranų pajamos',
    description: 'Pajamos pagal ekranus ir pasirinktą laikotarpį.',
  },
  partners: {
    title: 'Partneriai',
    description: 'Partnerių pajamų suvestinė.',
  },
  agencies: {
    title: 'Agentūros',
    description: 'Agentūrų užsakymų ir sumų analizė.',
  },
  latest: {
    title: 'Naujausi',
    description: 'Neseniai patvirtinti užsakymai.',
  },
  analytics: {
    title: 'Analizė',
    description: 'KPI ir tendencijos pagal užsakymus.',
  },
};

export const APP_TABS: AppTab[] = ['orders', 'revenue', 'partners', 'agencies', 'latest', 'analytics', 'invoices'];
