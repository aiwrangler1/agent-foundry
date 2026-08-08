export interface ScopedRepository<T extends { id: string }> { get(id: string): Promise<T | undefined>; put(value: T): Promise<T>; }
export const providerBoundary = "Supabase is an adapter; domain packages do not import its SDK.";
