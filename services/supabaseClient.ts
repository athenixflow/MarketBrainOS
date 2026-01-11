
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

/**
 * Supabase client instance.
 * If environment variables are missing, this returns a robust mock client to prevent the app from crashing
 * and support the chaining patterns used in persistenceService.
 */
let client: any;

if (isConfigured) {
  client = createClient(supabaseUrl!, supabaseAnonKey!);
} else {
  const noop = () => {};
  
  /**
   * Creates a proxy-like chainable object that behaves like a Promise 
   * and implements the common Supabase query methods.
   */
  const createChainableMock = () => {
    const promise = Promise.resolve({ data: null, error: null });
    const mock: any = {
      // Allow the object to be awaited directly
      then: (onfulfilled: any, onrejected: any) => promise.then(onfulfilled, onrejected),
      catch: (onrejected: any) => promise.catch(onrejected),
      finally: (onfinally: any) => promise.finally(onfinally),
      
      // Query building methods (return the mock itself for chaining)
      select: () => mock,
      insert: () => mock,
      update: () => mock,
      delete: () => mock,
      eq: () => mock,
      neq: () => mock,
      gt: () => mock,
      lt: () => mock,
      gte: () => mock,
      lte: () => mock,
      like: () => mock,
      ilike: () => mock,
      is: () => mock,
      in: () => mock,
      contains: () => mock,
      order: () => mock,
      limit: () => mock,
      single: () => mock,
      maybeSingle: () => mock,
      csv: () => mock,
      abortSignal: () => mock,
      match: () => mock,
    };
    return mock;
  };

  client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => createChainableMock(),
  };
}

export const supabase = client;
export const isSupabaseConfigured = isConfigured;
