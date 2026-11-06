import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import History from "./pages/History";

import Navbar from "./components/Navbar";

function LoadingScreen() {
return ( <div className="flex min-h-screen items-center justify-center bg-background text-zinc-300"> <div className="text-center"> <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-accent" /> <p>Loading AI Cloud Cost Detective...</p> </div> </div>
);
}

function ProtectedLayout() {
const { user, loading } = useAuth();

if (loading) {
return <LoadingScreen />;
}

if (!user) {
return <Navigate to="/login" replace />;
}

return ( <div className="min-h-screen bg-background text-zinc-100"> <Navbar />


  <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/report/:analysisId" element={<Report />} />
      <Route path="/history" element={<History />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </main>
</div>


);
}

export default function App() {
return ( <Routes>
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Signup />} />


  <Route path="/*" element={<ProtectedLayout />} />
</Routes>


);
}
