export default function Loader({ show }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center rounded bg-white/70 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}
