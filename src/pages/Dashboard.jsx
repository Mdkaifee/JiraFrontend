import Sidebar from "../components/Sidebar";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useContext(AuthContext);

  const displayName = user?.fullName || user?.firstName || "User";

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-3xl font-bold">
        Welcome, {displayName} 👋
      </div>
    </div>
  );
}
