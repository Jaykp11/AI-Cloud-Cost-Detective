import {
createContext,
useCallback,
useContext,
useEffect,
useState,
type ReactNode,
} from "react";

import { authApi, TOKEN_KEY } from "../lib/api";
import type { User } from "../lib/types";

interface AuthContextValue {
user: User | null;
loading: boolean;
isAuthenticated: boolean;
login: (email: string, password: string) => Promise<void>;
signup: (email: string, password: string) => Promise<void>;
logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(
undefined,
);

interface AuthProviderProps {
children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState(true);

const clearSession = useCallback(() => {
localStorage.removeItem(TOKEN_KEY);
setUser(null);
}, []);

/* --------------------------------------------------
Restore an existing session
-------------------------------------------------- */

useEffect(() => {
let active = true;


async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    if (active) {
      setLoading(false);
    }

    return;
  }

  try {
    const currentUser = await authApi.me();

    if (active) {
      setUser(currentUser);
    }
  } catch {
    if (active) {
      clearSession();
    }
  } finally {
    if (active) {
      setLoading(false);
    }
  }
}

void restoreSession();

return () => {
  active = false;
};


}, [clearSession]);

/* --------------------------------------------------
Login
-------------------------------------------------- */

const login = useCallback(
async (email: string, password: string) => {
const result = await authApi.login({
email: email.trim(),
password,
});


  if (!result.access_token) {
    throw new Error(
      "The backend did not return an access token.",
    );
  }

  localStorage.setItem(TOKEN_KEY, result.access_token);

  try {
    const currentUser = await authApi.me();
    setUser(currentUser);
  } catch (error) {
    clearSession();
    throw error;
  }
},
[clearSession],


);

/* --------------------------------------------------
Signup
-------------------------------------------------- */

const signup = useCallback(
async (email: string, password: string) => {
// The backend returns a message and user object,
// not an access token. The user must log in afterward.
await authApi.signup({
email: email.trim(),
password,
});
},
[],
);

/* --------------------------------------------------
Logout
-------------------------------------------------- */

const logout = useCallback(() => {
clearSession();
}, [clearSession]);

/* --------------------------------------------------
Context value
-------------------------------------------------- */

const value: AuthContextValue = {
user,
loading,
isAuthenticated: Boolean(user),
login,
signup,
logout,
};

return (
<AuthContext.Provider value={value}>
{children}
</AuthContext.Provider>
);
}

export function useAuth(): AuthContextValue {
const context = useContext(AuthContext);

if (!context) {
throw new Error(
"useAuth must be used inside AuthProvider.",
);
}

return context;
}
