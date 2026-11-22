export const ROUTES = {
  login: "/login",
  register: "/register",
  tickets: "/tickets",
  ticketNew: "/tickets/new",
  ticket: (id: string) => `/tickets/${id}`,
  queue: "/support/queue",
} as const;
