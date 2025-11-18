import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({
  success: () => {},
  error: () => {},
  info: () => {},
});

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info") => {
      const id = generateId();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), 3000);
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      success: (msg) => showToast(msg, "success"),
      error: (msg) => showToast(msg, "error"),
      info: (msg) => showToast(msg, "info"),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex w-full max-w-xs flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded border px-4 py-3 text-sm shadow-lg transition-all ${
              toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : toast.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
