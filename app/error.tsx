"use client"; // Error boundaries must be Client Components

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="grid h-dvh place-items-center bg-space p-6 text-center text-slate-300">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong with the globe</h1>
        <p className="mt-2 text-slate-400">{error.message}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 rounded-lg bg-white px-4 py-2 font-semibold text-slate-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
