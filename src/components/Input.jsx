export default function Input({ label, ...props }) {
  return (
    <div className="mb-3">
      <label className="block mb-1 text-gray-700">{label}</label>
      <input
        {...props}
        className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
