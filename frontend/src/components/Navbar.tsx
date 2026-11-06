import { Link, NavLink, useNavigate } from "react-router-dom";
import { Cloud, LayoutDashboard, History, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
const { user, logout } = useAuth();
const navigate = useNavigate();

function handleLogout() {
logout();
navigate("/login", { replace: true });
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
      isActive
        ? "bg-accent/15 text-purple-300"
        : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

return ( <header className="border-b border-border bg-surface"> <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"> <Link to="/dashboard" className="flex items-center gap-3"> <div className="rounded-xl bg-accent/15 p-2"> <Cloud className="h-6 w-6 text-purple-400" /> </div>


      <div>
        <h1 className="text-sm font-bold text-white sm:text-base">
          AI Cloud Cost Detective
        </h1>
        <p className="text-xs text-zinc-500">
          AWS cost optimization
        </p>
      </div>
    </Link>

    <nav className="flex flex-wrap items-center gap-1">
      <NavLink to="/dashboard" className={linkClass}>
        <LayoutDashboard size={16} />
        Dashboard
      </NavLink>

      <NavLink to="/history" className={linkClass}>
        <History size={16} />
        History
      </NavLink>
    </nav>

    <div className="flex items-center gap-3">
      <span className="hidden max-w-40 truncate text-sm text-zinc-400 sm:block">
        {user?.email}
      </span>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:text-red-400"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  </div>
</header>


);
}
